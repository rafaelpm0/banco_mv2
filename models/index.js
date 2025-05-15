import { connectToDatabase, closeDatabaseConnection } from '../DBs/mySql/mqSql.js';
import { conectarMongoDB, closeMongoDb } from '../DBs/mongoDB/mongoDB.js';

// Função para buscar um lote de funcionários usando LIMIT e OFFSET
async function fetchBatch(limit, offset) {
  try {
    const sequelize = connectToDatabase();
    const [results] = await sequelize.query(`
      SELECT 
        e.emp_no,
        e.first_name,
        e.last_name,
        e.birth_date,
        e.gender,
        e.hire_date,
        s.salary,
        s.from_date AS salary_from_date,
        s.to_date AS salary_to_date,
        t.title,
        t.from_date AS title_from_date,
        t.to_date AS title_to_date,
        d.dept_name,
        de.from_date AS dept_emp_from_date,
        de.to_date AS dept_emp_to_date,
        de.dept_no AS emp_dept_no,
        -- Dados do gerente do departamento
        dm.emp_no AS manager_emp_no,
        dm.dept_no AS manager_dept_no,
        d.dept_name AS manager_dept_name,
        dm.from_date AS manager_from_date,
        dm.to_date AS manager_to_date,
        mgr.first_name AS manager_first_name,
        mgr.last_name AS manager_last_name
      FROM 
        employees e
      LEFT JOIN 
        salaries s ON e.emp_no = s.emp_no
      LEFT JOIN 
        titles t ON e.emp_no = t.emp_no
      LEFT JOIN 
        dept_emp de ON e.emp_no = de.emp_no
      LEFT JOIN 
        departments d ON de.dept_no = d.dept_no
      LEFT JOIN dept_manager dm ON de.dept_no = dm.dept_no
        AND de.from_date <= dm.to_date AND de.to_date >= dm.from_date
      LEFT JOIN employees mgr ON dm.emp_no = mgr.emp_no
      LIMIT ${limit} OFFSET ${offset};
    `);
    closeDatabaseConnection(sequelize);
    return results;
  } catch (error) {
    throw new Error(`Erro ao buscar funcionários em lote: ${error.message}`);
  }
}

// Função principal de importação em lotes
export async function importMongo(batchSize = 100, mongoLimit = 10, totalLimit = null) {
  let offset = 0;
  let totalImportados = 0;
  let client;

  try {
    const mongo = await conectarMongoDB();
    client = mongo.client;
    const db = mongo.db;
    const collection = db.collection('employees');

    while (true) {
      if (totalLimit !== null && totalImportados >= totalLimit) break;

      const data = await fetchBatch(batchSize, offset);
      if (data.length === 0) break;

      const grouped = {};
      for (const row of data) {
        const emp_no = row.emp_no;
        if (!grouped[emp_no]) {
          grouped[emp_no] = {
            emp_no: emp_no,
            first_name: row.first_name,
            last_name: row.last_name,
            birth_date: row.birth_date,
            gender: row.gender,
            hire_date: row.hire_date,
            salaries: [],
            titles: [],
            departments: [],
          };
        }

        // Salários
        if (row.salary && row.salary_from_date && row.salary_to_date) {
          const exists = grouped[emp_no].salaries.some(
            s => s.salary === row.salary &&
                 s.from_date.toISOString() === new Date(row.salary_from_date).toISOString() &&
                 s.to_date.toISOString() === new Date(row.salary_to_date).toISOString()
          );
          if (!exists) {
            grouped[emp_no].salaries.push({
              salary: row.salary,
              from_date: new Date(row.salary_from_date),
              to_date: new Date(row.salary_to_date)
            });
          }
        }

        // Títulos
        if (row.title && row.title_from_date && row.title_to_date) {
          const exists = grouped[emp_no].titles.some(
            t => t.title === row.title &&
                 t.from_date.toISOString() === new Date(row.title_from_date).toISOString() &&
                 t.to_date.toISOString() === new Date(row.title_to_date).toISOString()
          );
          if (!exists) {
            grouped[emp_no].titles.push({
              title: row.title,
              from_date: new Date(row.title_from_date),
              to_date: new Date(row.title_to_date)
            });
          }
        }

        // Departamentos
        if (row.dept_name && row.dept_emp_from_date && row.dept_emp_to_date) {
          const deptExists = grouped[emp_no].departments.some(
            d =>
              d.dept_name === row.dept_name &&
              d.from_date.toISOString() === new Date(row.dept_emp_from_date).toISOString() &&
              d.to_date.toISOString() === new Date(row.dept_emp_to_date).toISOString() &&
              d.manager_emp_no === (row.manager_emp_no || null)
          );
          if (!deptExists) {
            grouped[emp_no].departments.push({
              dept_name: row.dept_name,
              dept_no: row.emp_dept_no, // <-- Adicionado aqui
              from_date: new Date(row.dept_emp_from_date),
              to_date: new Date(row.dept_emp_to_date),
              manager_name: row.manager_first_name && row.manager_last_name
                ? `${row.manager_first_name} ${row.manager_last_name}`
                : null,
              manager_emp_no: row.manager_emp_no || null
            });
          }
        }

        // Gerente
        if (
          row.manager_emp_no &&
          row.manager_dept_no &&
          row.manager_from_date &&
          row.manager_to_date &&
          row.manager_dept_name &&
          String(emp_no) === String(row.manager_emp_no) // Comparação segura
        ) {
          grouped[emp_no].manager_info = {
            manager_emp_no: row.manager_emp_no,
            manager_dept_no: row.manager_dept_no,
            manager_dept_name: row.manager_dept_name,
            from_date: new Date(row.manager_from_date),
            to_date: new Date(row.manager_to_date)
          };
        }
      }

      let employees = Object.values(grouped).slice(0, mongoLimit);

      // Se totalLimit está definido, não ultrapasse o limite total
      if (totalLimit !== null && totalImportados + employees.length > totalLimit) {
        employees = employees.slice(0, totalLimit - totalImportados);
      }

      const operations = employees.map(emp => ({
        updateOne: {
          filter: { emp_no: emp.emp_no },
          update: { $set: emp },
          upsert: true
        }
      }));

      if (operations.length > 0) {
        await collection.bulkWrite(operations);
        totalImportados += operations.length;
        console.log(`Lote importado: ${operations.length} funcionários (offset atual: ${offset})`);
      }

      offset += batchSize;
    }

    console.log(`Importação concluída: ${totalImportados} funcionários inseridos/atualizados.`);
    console.log('Conexão com o banco de dados encerrada com sucesso.');
  } catch (error) {
    console.error('Erro ao importar para o MongoDB:', error);
    throw error;
  } finally {
    if (client) await closeMongoDb(client);
  }
}

// Para testar, aumente os valores:
importMongo(50000, 10000).catch(err => console.error('Erro na execução da importação:', err));
// batchSize = 1000, mongoLimit = 100, totalLimit = 10 (apenas 10 documentos no total)