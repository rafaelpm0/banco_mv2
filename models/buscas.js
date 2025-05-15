import { conectarMongoDB, closeMongoDb } from '../DBs/mongoDB/mongoDB.js';

async function findEmployeesByManagerDepartment(managerInput) {
  let client;
  try {
    const { db, client: mongoClient } = await conectarMongoDB();
    client = mongoClient;
    const collection = db.collection('employees');

    let managerEmpNo = null;

    if (!isNaN(managerInput)) {
      managerEmpNo = Number(managerInput);
    } else {
      // Busca o emp_no do gerente pelo nome
      const gerenteDoc = await collection.findOne({
        departments: { $elemMatch: { manager_name: managerInput } }
      });
      if (!gerenteDoc) {
        console.log(`Gerente "${managerInput}" não encontrado.`);
        return;
      }
      const dept = gerenteDoc.departments.find(d => d.manager_name === managerInput);
      managerEmpNo = dept?.manager_emp_no;
      if (!managerEmpNo) {
        console.log(`Gerente "${managerInput}" não encontrado.`);
        return;
      }
    }

    // 1. Buscar todos os períodos em que esse gerente foi responsável por algum departamento
    const managerPeriods = await collection.aggregate([
      { $match: { "manager_info.manager_emp_no": managerEmpNo } },
      {
        $group: {
          _id: "$manager_info.manager_dept_no",
          from_date: { $first: "$manager_info.from_date" },
          to_date: { $first: "$manager_info.to_date" }
        }
      }
    ]).toArray();

    if (managerPeriods.length === 0) {
      console.log(`O gerente ${managerInput} não está vinculado a nenhum departamento.`);
      return;
    }

    // 2. Para cada período, buscar funcionários cujos períodos se sobrepõem
    for (const period of managerPeriods) {
      const dept_no = period._id;
      const mgr_from = new Date(period.from_date);
      const mgr_to = new Date(period.to_date);

      const employees = await collection.find({
        departments: {
          $elemMatch: {
            dept_no: dept_no,
            from_date: { $lte: mgr_to },
            to_date: { $gte: mgr_from }
          }
        }
      }).toArray();

      console.log(`\nFuncionários do departamento ${dept_no} sob gerência de ${managerInput} (${mgr_from.toISOString().slice(0,10)} até ${mgr_to.toISOString().slice(0,10)}):`);
      employees.forEach(emp => {
        const dept = emp.departments.find(d =>
          d.dept_no === dept_no &&
          new Date(d.from_date) <= mgr_to && // entrou antes ou enquanto o gerente estava
          new Date(d.to_date) >= mgr_from && // saiu depois ou enquanto o gerente estava
          new Date(d.from_date) <= new Date(d.to_date) && // sanity check
          new Date(d.from_date) <= mgr_to && // entrou antes do gerente sair
          new Date(d.from_date) <= mgr_to && // entrou antes do gerente sair
          new Date(d.to_date) >= mgr_from // saiu depois do gerente entrar
        );
        // Só mostra se o funcionário realmente esteve no dept enquanto o gerente era chefe
        if (
          dept &&
          new Date(dept.from_date) <= mgr_to &&
          new Date(dept.to_date) >= mgr_from &&
          new Date(dept.from_date) <= new Date(dept.to_date)
        ) {
          // Aqui, para garantir que o funcionário não entrou depois do gerente sair:
          if (new Date(dept.from_date) <= mgr_to && new Date(dept.from_date) <= mgr_to) {
            console.log({
              emp_no: emp.emp_no,
              nome: `${emp.first_name} ${emp.last_name}`,
              dept_name: dept.dept_name,
              dept_from: dept.from_date,
              dept_to: dept.to_date
            });
          }
        }
      });
      console.log(`Total: ${employees.length} funcionário(s) nesse período.`);
    }
  } catch (error) {
    console.error('Erro ao buscar funcionários:', error);
  } finally {
    if (client) await closeMongoDb(client);
  }
}

// Teste com nome:
//findEmployeesByManagerDepartment("Leon DasSarma");

// Teste com ID:
findEmployeesByManagerDepartment(110511);
