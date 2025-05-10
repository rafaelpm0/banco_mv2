import { MongoClient } from 'mongodb';

// URL de conexão (local ou MongoDB Atlas)
const url = 'mongodb+srv://rafaelpmedeiros00:FSW5Q1oT0nSANaGf@cluster0.mi5x5wk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'; // Substitua pela URL do MongoDB Atlas, se necessário
const dbName = 'employees'; // Nome do banco de dados

// Função para conectar ao MongoDB
async function conectarMongoDB() {
  const client = new MongoClient(url);

  try {
    // Conectar ao servidor
    await client.connect();
    console.log('Conexão com o MongoDB estabelecida com sucesso!');

    // Selecionar o banco de dados
    const db = client.db(dbName);
    console.log(`Banco de dados selecionado: ${dbName}`);

    // Aqui você pode realizar operações no banco de dados
    // Exemplo: listar coleções
    const collections = await db.listCollections().toArray();
    console.log('Coleções disponíveis:', collections);
  } catch (err) {
    console.error('Erro ao conectar ao MongoDB:', err);
  } finally {
    // Fechar a conexão
    await client.close();
    console.log('Conexão com o MongoDB encerrada.');
  }
}

// Chamar a função
conectarMongoDB();