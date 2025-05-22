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
      // Busca o emp_no do gerente pelo nome completo no campo manager_info
      const gerenteDoc = await collection.findOne({
        "manager_info": { $exists: true },
        $expr: {
          $eq: [
            { $concat: ["$first_name", " ", "$last_name"] },
            managerInput
          ]
        }
      });
      if (!gerenteDoc) {
        console.log(`Gerente "${managerInput}" não encontrado.`);
        return;
      }
      managerEmpNo = gerenteDoc.emp_no;
    }

    // 1. Buscar todos os períodos em que esse gerente foi responsável por algum departamento
    const managerPeriods = await collection.aggregate([
      { $match: { "manager_info.manager_emp_no": managerEmpNo } },
      {
        $group: {
          _id: "$manager_info.manager_dept_name", // Usando nome do departamento
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
      const dept_name = period._id;
      const mgr_from = new Date(period.from_date);
      const mgr_to = new Date(period.to_date);

      const employees = await collection.find({
        departments: {
          $elemMatch: {
            dept_name: dept_name,
            from_date: { $lte: mgr_to },
            to_date: { $gte: mgr_from }
          }
        }
      }).toArray();

      console.log(`\nFuncionários do departamento "${dept_name}" sob gerência de ${managerInput} (${mgr_from.toISOString().slice(0,10)} até ${mgr_to.toISOString().slice(0,10)}):`);
      let count = 0;
employees.forEach((emp, index) => {
  const dept = emp.departments.find(d =>
    d.dept_name === dept_name &&
    new Date(d.from_date) <= mgr_to &&
    new Date(d.to_date) >= mgr_from
  );
  if (dept) {
    count++;
    console.log(`[${index + 1}]`, {
      emp_no: emp.emp_no,
      nome: `${emp.first_name} ${emp.last_name}`,
      dept_name: dept.dept_name,
      dept_from: dept.from_date,
      dept_to: dept.to_date
    });
  }
});

      console.log(`Total: ${count} funcionário(s) nesse período.`);
    }
  } catch (error) {
    console.error('Erro ao buscar funcionários:', error);
  } finally {
    if (client) await closeMongoDb(client);
  }
}

async function findEmployeesByTitle(titleInput) {
  let client;
  try {
    const { db, client: mongoClient } = await conectarMongoDB();
    client = mongoClient;
    const collection = db.collection('employees');

    const employees = await collection.find({
      "titles.title": titleInput
    }).toArray();

    if (employees.length === 0) {
      console.log(`Nenhum funcionário encontrado com o título "${titleInput}".`);
      return;
    }

    console.log(`Funcionários com o título "${titleInput}":`);
    let totalVinculos = 0;
    employees.forEach(emp => {
      const titles = emp.titles.filter(t => t.title === titleInput);
      totalVinculos += titles.length;
      titles.forEach(t => {
        console.log({
          emp_no: emp.emp_no,
          nome: `${emp.first_name} ${emp.last_name}`,
          title: t.title,
          from_date: t.from_date,
          to_date: t.to_date
        });
      });
    });
    console.log(`Total de vínculos com o título: ${totalVinculos}`);
    console.log(`Total de funcionários únicos: ${employees.length}`);
  } catch (error) {
    console.error('Erro ao buscar funcionários por título:', error);
  } finally {
    if (client) await closeMongoDb(client);
  }
}


async function findEmployeesByDepartment(departmentInput) {
  let client;
  try {
    const { db, client: mongoClient } = await conectarMongoDB();
    client = mongoClient;
    const collection = db.collection('employees');

    const employees = await collection.find({
      "departments.dept_name": departmentInput
    }).toArray();

    if (employees.length === 0) {
      console.log(`Nenhum funcionário encontrado no departamento "${departmentInput}".`);
      return;
    }

    console.log(`Funcionários no departamento "${departmentInput}":`);
    let totalVinculos = 0;
    employees.forEach(emp => {
      const vinculos = emp.departments.filter(d => d.dept_name === departmentInput);
      totalVinculos += vinculos.length;
      vinculos.forEach(v => {
        console.log({
          emp_no: emp.emp_no,
          nome: `${emp.first_name} ${emp.last_name}`,
          department: v.dept_name,
          from_date: v.from_date,
          to_date:v.to_date
        });
      });
    });
  } catch (error) {
    console.error('Erro ao buscar funcionários por departamento:', error);
  } finally {
    if (client) await closeMongoDb(client);
  }
}

async function listAvgSalaryByDepartment() {
  let client;
  try {
    const { db, client: mongoClient } = await conectarMongoDB();
    client = mongoClient;
    const collection = db.collection('employees');

    const avgSalaryByDept = await collection.aggregate([
      { $unwind: "$departments" },
      { $unwind: "$salaries" },
      {
        $match: {
          $expr: {
            $and: [
              { $lte: ["$departments.from_date", "$salaries.to_date"] },
              { $gte: ["$departments.to_date", "$salaries.from_date"] }
            ]
          }
        }
      },
      {
        $group: {
          _id: "$departments.dept_name",
          avgSalary: { $avg: "$salaries.salary" },
          count: { $sum: 1 }
        }
      },
      { $sort: { avgSalary: -1 } }
    ]).toArray();

    if (avgSalaryByDept.length === 0) {
      console.log("Nenhum dado encontrado para calcular média salarial por departamento.");
      return;
    }

    console.log("Média salarial por departamento:");
    avgSalaryByDept.forEach(dep => {
      console.log({
        departamento: dep._id,
        media_salarial: dep.avgSalary.toFixed(2),
        registros: dep.count
      });
    });
  } catch (error) {
    console.error('Erro ao calcular média salarial por departamento:', error);
  } finally {
    if (client) await closeMongoDb(client);
  }
}

// Function to measure search duration
async function measureSearchTime(searchFunction, ...args) {
  const startTime = performance.now();
  await searchFunction(...args);
  const endTime = performance.now();
  const duration = (endTime - startTime) / 1000; // Convert to seconds
  console.log(`Search took ${duration.toFixed(3)} seconds`);
}

// Export the new function along with existing ones
export { 
  findEmployeesByManagerDepartment, 
  findEmployeesByTitle, 
  findEmployeesByDepartment, 
  listAvgSalaryByDepartment,
  measureSearchTime 
};

//2a:
// Teste com nome:
//findEmployeesByManagerDepartment("DeForest Hagimont");
// Teste com ID:
//findEmployeesByManagerDepartment(110386);

//2b:
// Exemplo de uso:
// findEmployeesByTitle('Senior Engineer');

//2c:
// Exemplo de uso:
// findEmployeesByDepartment('Production');

//2d:
// Exemplo de uso:
// listAvgSalaryByDepartment();

//await measureSearchTime(findEmployeesByManagerDepartment, "Shem Kieras");
//await measureSearchTime(findEmployeesByManagerDepartment, 110386);
//await measureSearchTime(findEmployeesByTitle, "Senior Engineer");
//await measureSearchTime(findEmployeesByDepartment, 'Production');
//await measureSearchTime(listAvgSalaryByDepartment);