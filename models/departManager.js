
import { connectToDatabase, closeDatabaseConnection } from '../DBs/mySql/mqSql.js';

export async function fetchDepartManager(emp_no){
  try{
    const sequelize = connectToDatabase();
    const [results] = await sequelize.query('SELECT * FROM dept_manager WHERE emp_no = :emp_no', { replacements: { emp_no },});
    closeDatabaseConnection(sequelize);
    return results;

  }
  catch (error) {
    throw new Error(`Erro ao buscar todos os funcionários: ${error.message}`);
  }
}

const data = await fetchDepartManager("10001")
console.log(data)
