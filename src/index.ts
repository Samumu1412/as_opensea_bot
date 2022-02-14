const BN = require('bn.js');
require('dotenv').config();
import { 
  getEvents,
  getOrders,
  getFloorPrice,
  sendBuyTransaction,
} from "./opensea";
import {
  sleep,
} from "./utils";

for (const key of ['OPENSEA_API_KEY', 'CONTRACT_ADDRESS', 'COLLECTION_ID',
  'PRIVATE_KEY_HEX', 'WALLET_ADDRESS', 'INFURA_PROJECT_ID', 'GAS_PRICE', 'FLOOR_UNDERPRICED_RATIO']
) {
  if (!process.env[key]) {
    console.error(`Env ${key} not set. Exiting.`);
    process.exit(1);
  }
}

let currentFloorPrice = 0.0;
let floorPriceLastUpdate: Date;
let floorUnderpricedRatio = parseFloat(process.env.FLOOR_UNDERPRICED_RATIO!);
async function updateFloorIfNecessary() {
  const now = new Date();
  if (!floorPriceLastUpdate || 
    now.getTime() - floorPriceLastUpdate.getTime() > 1000 * 60) {
    currentFloorPrice = await getFloorPrice();
    floorPriceLastUpdate = now;
    console.log(`Current floor price: ${currentFloorPrice}`);
  }
}

const currentPrices = new Map<string, number>();
getFloorPrice().then(async (floorPrice) => {
  console.log(`Current floor price: ${floorPrice}`);
  currentFloorPrice = floorPrice
  floorPriceLastUpdate = new Date();
  while (true) {
    await updateFloorIfNecessary();
    const last30s = Math.floor(new Date().getTime()/1000) - 30;
    const events = await getEvents(last30s, "created");
    for (const event of events) {
      try {
        const tokenId = event["asset"]!["token_id"];
        const price = event["ending_price"] as string;
        const priceInEth = new BN(price) / new BN(10).pow(new BN(18));
        if (currentPrices.has(tokenId) && 
            currentPrices.get(tokenId)! == priceInEth) {
          continue;
        }
        currentPrices.set(tokenId, priceInEth);
        console.log(`New listed sell order: ${tokenId} at ${priceInEth} ETH`);
        if (priceInEth < currentFloorPrice * floorUnderpricedRatio) {
          console.log('Found low price sell order!');
          const orders = (await getOrders([tokenId]))
            .filter((order) => order['base_price'] == event["ending_price"]);
          if (orders.length == 0) {
            console.log(`No orders found for ${tokenId}`);
            continue;
          }
          const order = orders[0];
          await sendBuyTransaction(order);
        }
      } catch (error) {
        console.error(`[getEvents] error: ${error}`);
      }
    }
    await sleep(3000);
  }
});
