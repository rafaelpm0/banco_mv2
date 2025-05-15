import { connectToDatabase, closeDatabaseConnection } from '../DBs/mySql/mqSql.js';
import { MongoClient } from 'mongodb';

export async function fetchAll() {
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
        dm.emp_no AS manager_emp_no,
        dm.dept_no AS manager_dept_no,
        dm.from_date AS manager_from_date,
        dm.to_date AS manager_to_date,
        de.from_date AS dept_emp_from_date,
        de.to_date AS dept_emp_to_date,
        de.dept_no AS emp_dept_no
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
    LEFT JOIN 
        dept_manager dm ON d.dept_no = dm.dept_no AND e.emp_no = dm.emp_no;
    `);
    closeDatabaseConnection(sequelize);
    return results;
  } catch (error) {
    throw new Error(`Erro ao buscar todos os funcionários: ${error.message}`);
  }
}

export async function importMongo() {
  const data = await fetchAll();

  // Agrupar por emp_no
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
        manager_info: null
      };
    }

    // Evitar duplicatas ao inserir os dados corretamente
    if (row.salary) {
      grouped[emp_no].salaries.push({
        salary: row.salary,
        from_date: row.salary_from_date,
        to_date: row.salary_to_date
      });
    }

    if (row.title) {
      grouped[emp_no].titles.push({
        title: row.title,
        from_date: row.title_from_date,
        to_date: row.title_to_date
      });
    }

    if (row.dept_name) {
      grouped[emp_no].departments.push({
        dept_name: row.dept_name,
        from_date: row.dept_emp_from_date,
        to_date: row.dept_emp_to_date
      });
    }

    if (row.manager_emp_no) {
      grouped[emp_no].manager_info = {
        manager_emp_no: row.manager_emp_no,
        manager_dept_no: row.manager_dept_no,
        from_date: row.manager_from_date,
        to_date: row.manager_to_date
      };
    }
  }

  // Conectar ao MongoDB
  const url = 'mongodb+srv://rafaelpmedeiros00:FSW5Q1oT0nSANaGf@cluster0.mi5x5wk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
  const dbName = 'employees';
  const client = new MongoClient(url);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employees');

    // Pega apenas os 10 primeiros funcionários
    const first100 = Object.values(grouped).slice(0, 10);

    for (const emp of first100) {
      await collection.updateOne(
        { emp_no: emp.emp_no },
        { $set: emp },
        { upsert: true }
      );
    }

    console.log(`Importação concluída: ${first100.length} funcionários inseridos.`);
  } catch (error) {
    console.error('Erro ao importar para o MongoDB:', error);
  } finally {
    await client.close();
  }
}

// Executa a importação
importMongo();
