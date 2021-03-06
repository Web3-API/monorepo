import { PluginManifest, coreInterfaceUris } from "@web3api/core-js";

export const manifest: PluginManifest = {
  // TODO: use the schema.graphql
  // https://github.com/web3-api/monorepo/issues/101
  schema: `### Web3API Header START ###
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

type Query implements UriResolver_Query @imports(
  types: [
    "UriResolver_Query",
    "UriResolver_MaybeUriOrManifest"
  ]
) {
  catFile(
    cid: String!
    options: Options
  ): Bytes!

  resolve(
    cid: String!
    options: Options
  ): ResolveResult

  tryResolveUri(
    authority: String!
    path: String!
  ): UriResolver_MaybeUriOrManifest

  getFile(
    path: String!
  ): Bytes
}

type Mutation {
  # TODO: Allow for custom type CID
  # https://github.com/web3-api/monorepo/issues/103
  addFile(data: Bytes!): String!
}

type ResolveResult {
  cid: String!
  provider: String!
}

type Options {
  # Timeout (in ms) for the operation.
  # Fallback providers are used if timeout is reached.
  timeout: UInt64

  # The IPFS provider to be used
  provider: String
}

### Imported Queries START ###

type UriResolver_Query @imported(
  uri: "w3://ens/uri-resolver.core.web3api.eth",
  namespace: "UriResolver",
  nativeType: "Query"
) {
  tryResolveUri(
    authority: String!
    path: String!
  ): UriResolver_MaybeUriOrManifest

  getFile(
    path: String!
  ): Bytes
}

### Imported Queries END ###

### Imported Objects START ###

type UriResolver_MaybeUriOrManifest @imported(
  uri: "w3://ens/uri-resolver.core.web3api.eth",
  namespace: "UriResolver",
  nativeType: "MaybeUriOrManifest"
) {
  uri: String
  manifest: String
}

### Imported Objects END ###`,
  implements: [coreInterfaceUris.uriResolver],
};
