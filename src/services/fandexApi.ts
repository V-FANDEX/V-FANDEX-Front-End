import { conditionalOrders, currentUser, markets, rankings, scenarios, season, stocks, transactions } from './mockData';

const latency = 120;

const wait = <T,>(data: T): Promise<T> =>
  new Promise((resolve) => {
    window.setTimeout(() => resolve(data), latency);
  });

export const fandexApi = {
  getMarkets: () => wait(markets),
  getStocks: () => wait(stocks),
  getStock: (id: string) => wait(stocks.find((stock) => stock.id === id)),
  getSeason: () => wait(season),
  getCurrentUser: () => wait(currentUser),
  getRankings: () => wait(rankings),
  getScenarios: () => wait(scenarios),
  getConditionalOrders: () => wait(conditionalOrders),
  getTransactions: () => wait(transactions),
};
