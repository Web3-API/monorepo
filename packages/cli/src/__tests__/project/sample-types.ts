import { Client, PluginModule } from "@web3api/core-js";

export interface QueryModule extends PluginModule {
  getData: (
    input: Input_getData
  ) => number;
}

export interface Input_getData {
  address: string;
  connection?: Types.Ethereum_Connection | null;
}
export interface MutationModule extends PluginModule {
  setData: (
    input: Input_setData
  ) => Types.SetDataResult;
  deployContract: (
    input: Input_deployContract
  ) => string;
}

export interface Input_setData {
  options: Types.SetDataOptions;
  connection?: Types.Ethereum_Connection | null;
}
export interface Input_deployContract {
  connection?: Types.Ethereum_Connection | null;
}

export const schema = `### Web3API Header START ###
scalar UInt
scalar UInt8
scalar UInt16
scalar UInt32
scalar UInt64
scalar Int
scalar Int8
scalar Int16
scalar Int32
scalar Int64
scalar Bytes
scalar BigInt

directive @imported(
  uri: String!
  namespace: String!
  nativeType: String!
) on OBJECT | ENUM

directive @imports(
  types: [String!]!
) on OBJECT
### Web3API Header END ###

type Query @imports(
  types: [
    "Ethereum_Query",
    "Ethereum_Connection",
    "Ethereum_TxOverrides",
    "Ethereum_StaticTxResult",
    "Ethereum_TxRequest",
    "Ethereum_TxReceipt",
    "Ethereum_Log",
    "Ethereum_EventNotification"
  ]
) {
  getData(
    address: String!
    connection: Ethereum_Connection
  ): UInt32!
}

type Mutation @imports(
  types: [
    "Ethereum_Mutation",
    "Ethereum_Connection",
    "Ethereum_TxOverrides",
    "Ethereum_TxResponse",
    "Ethereum_Access",
    "Ethereum_TxReceipt",
    "Ethereum_Log",
    "Ethereum_TxRequest"
  ]
) {
  setData(
    options: SetDataOptions!
    connection: Ethereum_Connection
  ): SetDataResult!

  deployContract(
    connection: Ethereum_Connection
  ): String!
}

type SetDataOptions {
  address: String!
  value: UInt32!
}

type SetDataResult {
  txReceipt: String!
  value: UInt32!
}

### Imported Queries START ###

type Ethereum_Query @imported(
  uri: "w3://ens/ethereum.web3api.eth",
  namespace: "Ethereum",
  nativeType: "Query"
) {
  callContractView(
    address: String!
    method: String!
    args: [String!]
    connection: Ethereum_Connection
  ): String!

  callContractStatic(
    address: String!
    method: String!
    args: [String!]
    connection: Ethereum_Connection
    txOverrides: Ethereum_TxOverrides
  ): Ethereum_StaticTxResult!

  encodeParams(
    types: [String!]!
    values: [String!]!
  ): String!

  getSignerAddress(
    connection: Ethereum_Connection
  ): String!

  getSignerBalance(
    blockTag: BigInt
    connection: Ethereum_Connection
  ): BigInt!

  getSignerTransactionCount(
    blockTag: BigInt
    connection: Ethereum_Connection
  ): BigInt!

  getGasPrice(
    connection: Ethereum_Connection
  ): BigInt!

  estimateTransactionGas(
    tx: Ethereum_TxRequest!
    connection: Ethereum_Connection
  ): BigInt!

  estimateContractCallGas(
    address: String!
    method: String!
    args: [String!]
    connection: Ethereum_Connection
    txOverrides: Ethereum_TxOverrides
  ): BigInt!

  checkAddress(
    address: String!
  ): Boolean!

  toWei(
    eth: String!
  ): BigInt!

  toEth(
    wei: BigInt!
  ): String!

  awaitTransaction(
    txHash: String!
    confirmations: UInt32!
    timeout: UInt32!
    connection: Ethereum_Connection
  ): Ethereum_TxReceipt!

  waitForEvent(
    address: String!
    event: String!
    args: [String!]
    timeout: UInt32
    connection: Ethereum_Connection
  ): Ethereum_EventNotification!
}

type Ethereum_Mutation @imported(
  uri: "w3://ens/ethereum.web3api.eth",
  namespace: "Ethereum",
  nativeType: "Mutation"
) {
  callContractMethod(
    address: String!
    method: String!
    args: [String!]
    connection: Ethereum_Connection
    txOverrides: Ethereum_TxOverrides
  ): Ethereum_TxResponse!

  callContractMethodAndWait(
    address: String!
    method: String!
    args: [String!]
    connection: Ethereum_Connection
    txOverrides: Ethereum_TxOverrides
  ): Ethereum_TxReceipt!

  sendTransaction(
    tx: Ethereum_TxRequest!
    connection: Ethereum_Connection
  ): Ethereum_TxResponse!

  sendTransactionAndWait(
    tx: Ethereum_TxRequest!
    connection: Ethereum_Connection
  ): Ethereum_TxReceipt!

  deployContract(
    abi: String!
    bytecode: String!
    args: [String!]
    connection: Ethereum_Connection
  ): String!

  signMessage(
    message: String!
    connection: Ethereum_Connection
  ): String!

  sendRPC(
    method: String!
    params: [String!]!
    connection: Ethereum_Connection
  ): String
}

### Imported Queries END ###

### Imported Objects START ###

type Ethereum_Connection @imported(
  uri: "w3://ens/ethereum.web3api.eth",
  namespace: "Ethereum",
  nativeType: "Connection"
) {
  node: String
  networkNameOrChainId: String
}

type Ethereum_TxOverrides @imported(
  uri: "w3://ens/ethereum.web3api.eth",
  namespace: "Ethereum",
  nativeType: "TxOverrides"
) {
  gasLimit: BigInt
  gasPrice: BigInt
  value: BigInt
}

type Ethereum_StaticTxResult @imported(
  uri: "w3://ens/ethereum.web3api.eth",
  namespace: "Ethereum",
  nativeType: "StaticTxResult"
) {
  result: String!
  error: Boolean!
}

type Ethereum_TxRequest @imported(
  uri: "w3://ens/ethereum.web3api.eth",
  namespace: "Ethereum",
  nativeType: "TxRequest"
) {
  to: String
  from: String
  nonce: UInt32
  gasLimit: BigInt
  gasPrice: BigInt
  data: String
  value: BigInt
  chainId: UInt32
  type: UInt32
}

type Ethereum_TxReceipt @imported(
  uri: "w3://ens/ethereum.web3api.eth",
  namespace: "Ethereum",
  nativeType: "TxReceipt"
) {
  to: String!
  from: String!
  contractAddress: String!
  transactionIndex: UInt32!
  root: String
  gasUsed: BigInt!
  logsBloom: String!
  transactionHash: String!
  logs: [Ethereum_Log!]!
  blockNumber: BigInt!
  blockHash: String!
  confirmations: UInt32!
  cumulativeGasUsed: BigInt!
  effectiveGasPrice: BigInt!
  byzantium: Boolean!
  type: UInt32!
  status: UInt32
}

type Ethereum_Log @imported(
  uri: "w3://ens/ethereum.web3api.eth",
  namespace: "Ethereum",
  nativeType: "Log"
) {
  blockNumber: BigInt!
  blockHash: String!
  transactionIndex: UInt32!
  removed: Boolean!
  address: String!
  data: String!
  topics: [String!]!
  transactionHash: String!
  logIndex: UInt32!
}

type Ethereum_EventNotification @imported(
  uri: "w3://ens/ethereum.web3api.eth",
  namespace: "Ethereum",
  nativeType: "EventNotification"
) {
  data: String!
  address: String!
  log: Ethereum_Log!
}

type Ethereum_TxResponse @imported(
  uri: "w3://ens/ethereum.web3api.eth",
  namespace: "Ethereum",
  nativeType: "TxResponse"
) {
  hash: String!
  to: String
  from: String!
  nonce: UInt32!
  gasLimit: BigInt!
  gasPrice: BigInt
  data: String!
  value: BigInt!
  chainId: UInt32!
  blockNumber: BigInt
  blockHash: String
  timestamp: UInt32
  confirmations: UInt32!
  raw: String
  r: String
  s: String
  v: UInt32
  type: UInt32
  accessList: [Ethereum_Access!]
}

type Ethereum_Access @imported(
  uri: "w3://ens/ethereum.web3api.eth",
  namespace: "Ethereum",
  nativeType: "Access"
) {
  address: String!
  storageKeys: [String!]!
}

### Imported Objects END ###
`;