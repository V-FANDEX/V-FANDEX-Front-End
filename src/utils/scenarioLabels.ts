import type { Market, ScenarioLog, Stock } from '../types';

export function formatStockWithMarket(stock: Stock, markets: Market[] = []) {
  const marketName = stock.market?.name ?? markets.find((market) => market.id === stock.marketId)?.name;
  return marketName ? `${marketName} · ${stock.name}` : stock.name;
}

export function getScenarioTargetLabels(scenario: ScenarioLog, stocks: Stock[], markets: Market[]) {
  const labelsFromImpacts = scenario.impacts
    ?.map((impact) => {
      const stock = stocks.find((item) => item.id === impact.stockId);
      const marketName =
        impact.marketName ??
        stock?.market?.name ??
        markets.find((market) => market.id === (impact.marketId || stock?.marketId))?.name;
      const stockName = impact.stockName ?? stock?.name ?? impact.stockId;
      return marketName ? `${marketName} · ${stockName}` : stockName;
    })
    .filter(Boolean);

  if (labelsFromImpacts?.length) return uniqueLabels(labelsFromImpacts);

  const labelsFromStocks = scenario.affectedStockIds
    .map((stockId, index) => {
      const stock = stocks.find((item) => item.id === stockId);
      if (stock) return formatStockWithMarket(stock, markets);
      const marketName = markets.find((market) => market.id === scenario.affectedMarketIds[index])?.name;
      return marketName ? `${marketName} · ${stockId}` : stockId;
    })
    .filter(Boolean);

  if (labelsFromStocks.length) return uniqueLabels(labelsFromStocks);

  const labelsFromMarkets = scenario.affectedMarketIds
    .map((marketId) => markets.find((market) => market.id === marketId)?.name ?? marketId)
    .map((marketName) => `${marketName} 전체`);

  return labelsFromMarkets.length ? uniqueLabels(labelsFromMarkets) : ['영향 대상 미정'];
}

function uniqueLabels(labels: string[]) {
  return [...new Set(labels)];
}
