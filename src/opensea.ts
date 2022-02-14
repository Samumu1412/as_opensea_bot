import axios from "axios";
import { BN, toBuffer } from "ethereumjs-util";
import web3 from "web3";
import { Transaction } from '@ethereumjs/tx'
import Common, { Chain, Hardfork } from '@ethereumjs/common'
const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.London })

const Web3EthContract = require('web3-eth-contract');
const openseaAbi = require('./opensea-abi.json');

const {
  OPENSEA_API_KEY: apiKey = '',
  CONTRACT_ADDRESS: contractAddress = '',
  COLLECTION_ID: collectionId = '',
  PRIVATE_KEY_HEX: privateKeyHex = '',
  WALLET_ADDRESS: walletAddress = '',
  INFURA_PROJECT_ID: infuraProjectId = '',
  GAS_PRICE: gasPrice = '',
} = process.env;

const openseaContractAddr = "0x7be8076f4ea4a4ad08075c2508e481d6c946d12b";
const privateKey = Buffer.from(privateKeyHex, 'hex');
const web3js = new web3(
  new web3.providers.HttpProvider(`https://mainnet.infura.io/v3/${infuraProjectId}`)
);
const openseaContract = new Web3EthContract(openseaAbi, openseaContractAddr)

/**
 * Get events after certain time
 * @param afterTime unix epoch in second
 * @param event event to query, e.g. created, successful, cancelled
 * @returns List of events
 */
 async function getEvents(afterTime: number, event: string): Promise<Array<any>> {
  try {
    const url = "https://api.opensea.io/api/v1/events";
    const params = {
      asset_contract_address: contractAddress,
      only_opensea: false,
      event_type: event,
      offset: 0,
      limit: 300,
      occurred_after: afterTime,
    };
    const allEvents = [];
    while(true) {
      const response = await axios.get(url, {
        params: params,
        headers: {'X-API-KEY': apiKey},
      });
      if (response.status !== 200) {
        throw new Error(`[getEvents] Failed to get events: ${response.status}`);
      }
      const events = response.data["asset_events"];
      allEvents.push(...events);
      params.offset += 300;
      if (events.length < 300) {
        break;
      }
    }
    return allEvents;
  } catch (error) {
    console.error(`[getEvents] error: ${error}`);
    return [];
  }
}

async function getOrders(tokenIds: Array<string>): Promise<Array<any>> {
  try {
    const url = "https://api.opensea.io/wyvern/v1/orders"
    const params = new URLSearchParams();
    const orders = new Array();
    params.append("asset_contract_address", contractAddress);
    params.append("side", "1");
    params.append("sale_kind", "0");
    params.append("is_english", "false");
    params.append("limit", "50");
    params.append("offset", "0");
    tokenIds.forEach((tokenId) => {
      params.append("token_ids", tokenId);
    });
    while (true) {
      const response = await axios.get(url, {
        params: params,
        headers: {'X-API-KEY': apiKey},
      });
      if (response.status !== 200) {
        throw new Error(`[getOrders] Failed to get orders: ${response.status}`);
      }
      const data = response.data["orders"] as Array<any>;
      orders.push(...data);
      if (data.length < 50) {
        break;
      }
    }
    return orders;
  } catch (error) {
    console.error(`[getOrders] error: ${error}`);
    return [];
  }
}

async function getFloorPrice(): Promise<number> {
  try {
    const url = `https://api.opensea.io/api/v1/collection/${collectionId}/stats`;
    const response = await axios.get(url, {
      headers: {'X-API-KEY': apiKey},
    });
    if (response.status !== 200) {
      throw new Error(`[getFloorPrice] Failed to get stats: ${response.status}`);
    }
    const stats = response.data["stats"];
    return stats["floor_price"];
  } catch (error) {
    console.error(`[getFloorPrice] error: ${error}`);
    return 0;
  }
}

let currentTxCount = -1;
async function sendBuyTransaction(order: any): Promise<string> {
  try {
    console.log('order:', order);
    const count = currentTxCount == -1 ?
      await web3js.eth.getTransactionCount(walletAddress) :
      currentTxCount + 1;
    console.log(`Current tx coount: ${count}`);
    
    const value = new BN(order['base_price'], 10);
    console.log(`value: ${value}`);
    const rawTransaction = {
      "from": walletAddress, 
      "gasLimit": web3js.utils.toHex(250000),
      "gasPrice": new BN(web3js.utils.toWei(gasPrice, 'gwei'), 10),
      "nonce": web3js.utils.toHex(count),
      "to": openseaContractAddr,
      "value": value,
      "chainId": "0x01",
      "type": "0x02",
      "data": getOrderContractData(order),
    };
    const tx = Transaction.fromTxData(rawTransaction, { common });
    const signedTx = tx.sign(privateKey);
    console.log(`signedTx:`, signedTx);

    console.log('Sending tx...');
    const receipt = await web3js.eth.sendSignedTransaction(
      '0x'+signedTx.serialize().toString('hex')
    );
    console.log(`Tx hash sent: ${receipt.transactionHash}`);
    if (receipt.transactionHash && receipt.transactionHash.length > 0) {
      currentTxCount = count;
      console.log(`Updated currentTxCount: ${currentTxCount}`);
    }
    return receipt.transactionHash;
  } catch (error) {
    console.error('Got error in sendBuyTransaction:', error);
    return '';
  }
}

function getOrderContractData(order: any): string {
  const timestamp = Math.floor(new Date().getTime() / 1000 - 180);
  const salt = "80924056284120424315533358126190893090476275160099819580315001835632701285303";
  const addresses = [
    order['exchange'],
    walletAddress,
    order["maker"]["address"],
    '0x0000000000000000000000000000000000000000',
    contractAddress,
    '0x0000000000000000000000000000000000000000',
    '0x0000000000000000000000000000000000000000',

    order['exchange'],
    order["maker"]["address"],
    '0x0000000000000000000000000000000000000000',
    order["fee_recipient"]["address"],
    contractAddress,
    '0x0000000000000000000000000000000000000000',
    '0x0000000000000000000000000000000000000000',
  ];
  const uints = [
    parseInt(order['maker_relayer_fee']),
    parseInt(order['taker_relayer_fee']),
    parseInt(order['maker_protocol_fee']),
    parseInt(order['taker_protocol_fee']),
    order['base_price'],
    parseInt(order['extra']),
    timestamp,
    0,
    salt,

    parseInt(order['maker_relayer_fee']),
    parseInt(order['taker_relayer_fee']),
    parseInt(order['maker_protocol_fee']),
    parseInt(order['taker_protocol_fee']),
    order['base_price'],
    parseInt(order['extra']),
    order["listing_time"],
    order["expiration_time"],
    order['salt'],
  ];
  const feeMethodsSidesKindsHowToCalls = [
    order['fee_method'],
    0,
    order['sale_kind'],
    order['how_to_call'],
    order['fee_method'],
    1,
    order['sale_kind'],
    order['how_to_call'],
  ];

  const calldataBuy = '0x23b872dd' +
    '0000000000000000000000000000000000000000000000000000000000000000' +
    walletAddress.toLowerCase().substring(2).padStart(64, '0') +
    web3js.utils.toHex(order["asset"]["token_id"]).substring(2).padStart(64, '0');
  const replacementPatternBuy = '0x00000000' + 
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' +
    '0000000000000000000000000000000000000000000000000000000000000000' +
    '0000000000000000000000000000000000000000000000000000000000000000';
  return openseaContract.methods.atomicMatch_(
    addresses,
    uints,
    feeMethodsSidesKindsHowToCalls,
    toBuffer(calldataBuy),
    toBuffer(order['calldata']),
    toBuffer(replacementPatternBuy),
    toBuffer(order['replacement_pattern']),
    toBuffer(order['static_extradata']),
    toBuffer(order['static_extradata']),
    [order['v'], order['v']],
    [
      order['r'],
      order['s'],
      order['r'],
      order['s'],
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    ],
  )
    .encodeABI();
}

export {getEvents, getOrders, getFloorPrice, sendBuyTransaction};