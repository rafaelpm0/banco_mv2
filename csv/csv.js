import fs from 'fs';
import csv from 'csv-parser';

/**
 * Função para processar o arquivo CSV e retornar os dados como um array de objetos.
 * @param {string} filePath - Caminho do arquivo CSV.
 * @returns {Promise<Array<Object>>} - Promise que resolve com os dados processados.
 */
export function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const data = [];

    fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(
        csv({
          separator: ',',
          mapHeaders: ({ header }) => {
            return header.replace(/^\uFEFF/, '').replace(/"/g, '').trim();
          },
        })
      )
      .on('data', (row) => {
        const keys = Object.keys(row)[0].split(',');
        const values = row[Object.keys(row)[0]].split(',');
        const processedRow = {};
        keys.forEach((key, index) => {
          processedRow[key.trim()] = values[index] ? values[index].trim() : null;
        });

        data.push(processedRow);
      })
      .on('end', () => {
        resolve(data);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}
