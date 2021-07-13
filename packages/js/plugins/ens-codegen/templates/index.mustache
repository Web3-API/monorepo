/* eslint-disable import/no-extraneous-dependencies */
import { query } from "./resolvers";
import { manifest } from "./manifest";

import {
  Client,
  Plugin,
  PluginManifest,
  PluginModules,
  PluginFactory,
} from "@web3api/core-js";
import { ethers } from "ethers";
import { Base58 } from "@ethersproject/basex";
import { getAddress } from "@ethersproject/address";

export type Address = string;

export interface EnsConfig {
  address?: Address;
}

export class EnsPlugin extends Plugin {
  constructor(private _config: EnsConfig) {
    super();

    // Sanitize address
    if (this._config.address) {
      this.setAddress(this._config.address);
    }
  }

  public static manifest(): PluginManifest {
    return manifest;
  }

  public static isENSDomain(domain: string): boolean {
    return ethers.utils.isValidName(domain) && domain.indexOf(".eth") !== -1;
  }

  // TODO: generated types here from the schema.graphql to ensure safety `Resolvers<TQuery, TMutation>`
  // https://github.com/web3-api/monorepo/issues/101
  public getModules(client: Client): PluginModules {
    return {
      query: query(this, client),
    };
  }

  public setAddress(address: Address): void {
    this._config.address = getAddress(address);
  }

  public async ensToCID(domain: string, client: Client): Promise<string> {
    const ensAddress =
      this._config.address || "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
    const ensAbi = {
      resolver:
        "function resolver(bytes32 node) external view returns (address)",
    };
    const resolverAbi = {
      contenthash:
        "function contenthash(bytes32 nodehash) view returns (bytes)",
      content: "function content(bytes32 nodehash) view returns (bytes32)",
    };

    // Remove the ENS URI scheme & authority
    domain = domain.replace("w3://", "");
    domain = domain.replace("ens/", "");

    const domainNode = ethers.utils.namehash(domain);

    const callView = async (
      address: string,
      method: string,
      args: string[]
    ): Promise<string> => {
      const { data, errors } = await client.query({
        uri: "ens/ethereum.web3api.eth",
        query: `query {
          callView(
            address: $address,
            method: $method,
            args: $args
          )
        }`,
        variables: {
          address,
          method,
          args,
        },
      });

      if (errors && errors.length) {
        throw errors;
      }

      if (data && data.callView) {
        if (typeof data.callView !== "string") {
          throw Error(
            `Malformed data returned from Ethereum.callView: ${data.callView}`
          );
        }

        return data.callView;
      }

      throw Error(
        `Ethereum.callView returned nothing.\nData: ${data}\nErrors: ${errors}`
      );
    };

    // Get the node's resolver address
    const resolverAddress = await callView(ensAddress, ensAbi.resolver, [
      domainNode,
    ]);

    // Get the CID stored at this domain
    let hash;
    try {
      hash = await callView(resolverAddress, resolverAbi.contenthash, [
        domainNode,
      ]);
    } catch (e) {
      try {
        // Fallback, contenthash doesn't exist, try content
        hash = await callView(resolverAddress, resolverAbi.content, [
          domainNode,
        ]);
      } catch (err) {
        // The resolver contract is unknown...
        throw Error(`Incompatible resolver ABI at address ${resolverAddress}`);
      }
    }

    if (hash === "0x") {
      return "";
    }

    if (
      hash.substring(0, 10) === "0xe3010170" &&
      ethers.utils.isHexString(hash, 38)
    ) {
      return Base58.encode(ethers.utils.hexDataSlice(hash, 4));
    } else {
      throw Error(`Unkown CID format, CID hash: ${hash}`);
    }
  }
}

export const ensPlugin: PluginFactory<EnsConfig> = (opts: EnsConfig) => {
  return {
    factory: () => new EnsPlugin(opts),
    manifest: manifest,
  };
};
export const plugin = ensPlugin;
