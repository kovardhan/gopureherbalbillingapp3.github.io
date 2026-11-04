import { parseVagueText } from './parser.js';

const testInput = `
Rice 1 5kg 250
Rice 5kg 250
2 Rice 5kg 250
Rice 2 5kg 250
Colgate 100g 55
3 Colgate 100g 55
Bread 2 400g 45
Maggie 4 14
Sugar 2kg 90
Sunflower oil 2 1ltr 160
`;

const results = parseVagueText(testInput);
console.table(results.map(r => ({
  Name: r.name,
  Count: r.count,
  Quantity: r.quantity,
  Rate: r.rate,
  Amount: r.amount
})));
