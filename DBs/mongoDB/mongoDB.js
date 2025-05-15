import { MongoClient } from 'mongodb';

// URL de conexão (local ou MongoDB Atlas)
const url = 'mongodb+srv://rafaelpmedeiros00:FSW5Q1oT0nSANaGf@cluster0.mi5x5wk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'; // Substitua pela URL do MongoDB Atlas, se necessário
const dbName = 'employees'; // Nome do banco de dados

// Função para conectar ao MongoDB e retornar db e client
export async function conectarMongoDB() {
  const client = new MongoClient(url);
  await client.connect();
  console.log('Conexão com o MongoDB estabelecida com sucesso!');
  const db = client.db(dbName);
  return { db, client };
}

export async function closeMongoDb(client) {
  await client.close();
  console.log('Conexão com o MongoDB encerrada.');
}