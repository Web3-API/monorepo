import {
  ClientConfig,
  createWeb3ApiClient,
  Plugin, Subscription,
  Uri
} from "../";
import {
  buildAndDeployApi,
  initTestEnvironment,
  stopTestEnvironment
} from "@web3api/test-env-js";
import { GetPathToTestApis } from "@web3api/test-cases";
import { Web3ApiClient } from "../Web3ApiClient";
import { getDefaultClientConfig } from "../default-client-config";
import { coreInterfaceUris } from '@web3api/core-js';

jest.setTimeout(200000);

describe("Web3ApiClient", () => {
  let ipfsProvider: string;
  let ethProvider: string;
  let ensAddress: string;

  beforeAll(async () => {
    const { ipfs, ethereum, ensAddress: ens } = await initTestEnvironment();
    ipfsProvider = ipfs;
    ethProvider = ethereum;
    ensAddress = ens;
  });

  afterAll(async () => {
    await stopTestEnvironment();
  });

  const getClient = async (config?: ClientConfig) => {
    return createWeb3ApiClient({
      ethereum: {
        networks: {
          testnet: {
            provider: ethProvider
          },
        },
      },
      ipfs: { provider: ipfsProvider },
      ens: {
        addresses: {
          testnet: ensAddress
        }
      }
    }, config);
  }
  
  it("default client config", () => {
    const client = new Web3ApiClient();

    expect(client.redirects()).toStrictEqual([]);
    expect(
        client.plugins().map(x => x.uri)
      ).toStrictEqual([ 
        new Uri("w3://ens/ipfs.web3api.eth"),
        new Uri("w3://ens/ens.web3api.eth"),
        new Uri("w3://ens/ethereum.web3api.eth"),
        new Uri("w3://ens/js-logger.web3api.eth"),
        new Uri("w3://ens/uts46.web3api.eth"),
        new Uri("w3://ens/sha3.web3api.eth"),
      ]);
    expect(
        client.interfaces()
      ).toStrictEqual([
      {
        interface: coreInterfaceUris.uriResolver,
        implementations: [
          new Uri("w3://ens/ipfs.web3api.eth"), 
          new Uri("w3://ens/ens.web3api.eth")
        ]
      },
      {
        interface: coreInterfaceUris.logger,
        implementations: [
          new Uri("w3://ens/js-logger.web3api.eth")
        ]
      }]);
  });

  it("redirect registration", () => {
    const implementation1Uri = "w3://ens/some-implementation1.eth";
    const implementation2Uri = "w3://ens/some-implementation2.eth";
    
    const client = new Web3ApiClient({
        redirects: [
          {
            from: implementation1Uri,
            to: implementation2Uri
          }
        ]
      });

    const redirects = client.redirects();

    expect(redirects).toEqual([
      {
        from: new Uri(implementation1Uri),
        to: new Uri(implementation2Uri),
      }
    ]);
  });

  it("plugin registration - with default plugins", () => {
    const implementationUri = "w3://ens/some-implementation.eth";
    const defaultPlugins = [
      "w3://ens/ipfs.web3api.eth",
      "w3://ens/ens.web3api.eth",
      "w3://ens/ethereum.web3api.eth",
      "w3://ens/js-logger.web3api.eth",
      "w3://ens/uts46.web3api.eth",
      "w3://ens/sha3.web3api.eth",
    ];

    const client = new Web3ApiClient({
        plugins: [
          {
            uri: implementationUri,
            plugin: {
              factory: () => ({} as Plugin),
              manifest: {
                schema: "",
                implements: [],
              }
            }
          }
        ]
      });

    const pluginUris = client.plugins().map(x => x.uri.uri);

    expect(pluginUris).toEqual([implementationUri].concat(defaultPlugins));
  });

  it("interface registration", () => {
    const interfaceUri = "w3://ens/some-interface1.eth";
    const implementation1Uri = "w3://ens/some-implementation1.eth";
    const implementation2Uri = "w3://ens/some-implementation2.eth";
    
    const client = new Web3ApiClient({
        interfaces: [
          {
            interface: interfaceUri,
            implementations: [
              implementation1Uri,
              implementation2Uri
            ]
          }
        ]
      });

    const interfaces = client.interfaces();


    const defaultClientConfig = getDefaultClientConfig();

    expect(interfaces).toEqual([
        {
          interface: new Uri(interfaceUri),
          implementations: [
            new Uri(implementation1Uri),
            new Uri(implementation2Uri)
          ]
        }
      ].concat(defaultClientConfig.interfaces ?? []));

    const implementations = client.getImplementations(interfaceUri);

    expect(implementations).toEqual([
        implementation1Uri,
        implementation2Uri
      ]);
  });

  it("get all implementations of interface", async () => {

    const interface1Uri = "w3://ens/some-interface1.eth";
    const interface2Uri = "w3://ens/some-interface2.eth";
    const interface3Uri = "w3://ens/some-interface3.eth";

    const implementation1Uri = "w3://ens/some-implementation.eth";
    const implementation2Uri = "w3://ens/some-implementation2.eth";
    const implementation3Uri = "w3://ens/some-implementation3.eth";
    const implementation4Uri = "w3://ens/some-implementation4.eth";

    const client = await getClient({
      redirects: [
        {
          from: interface1Uri,
          to: interface2Uri
        },
        {
          from: implementation1Uri,
          to: implementation2Uri
        },
        {
          from: implementation2Uri,
          to: implementation3Uri
        }
      ],
      plugins: [
        {
          uri: implementation4Uri,
          plugin: {
            factory: () => ({} as Plugin),
            manifest: {
              schema: "",
              implements: [],
            }
          }
        }
      ],
      interfaces: [
        {
          interface: interface1Uri,
          implementations: [
            implementation1Uri,
            implementation2Uri
          ]
        },
        {
          interface: interface2Uri,
          implementations: [
            implementation3Uri
          ]
        },
        {
          interface: interface3Uri,
          implementations: [
            implementation3Uri,
            implementation4Uri
          ]
        }
      ]
    });
    
    const implementations1 = client.getImplementations(interface1Uri, { applyRedirects: true });
    const implementations2 = client.getImplementations(interface2Uri, { applyRedirects: true });
    const implementations3 = client.getImplementations(interface3Uri, { applyRedirects: true });

    expect(implementations1).toEqual([
        implementation1Uri,
        implementation2Uri,
        implementation3Uri
      ]);

    expect(implementations2).toEqual([
        implementation1Uri,
        implementation2Uri,
        implementation3Uri
      ]);

    expect(implementations3).toEqual([
        implementation3Uri,
        implementation4Uri
      ]);
  });

  it("plugins should not get registered with an interface uri (without default plugins)", () => {
    const interface1Uri = "w3://ens/some-interface1.eth";
    const interface2Uri = "w3://ens/some-interface2.eth";
    const interface3Uri = "w3://ens/some-interface3.eth";

    const implementationUri = "w3://ens/some-implementation.eth";
    
    expect(() => {
      new Web3ApiClient({
        plugins: [
          {
            uri: interface1Uri,
            plugin: {
              factory: () => ({} as Plugin),
              manifest: {
                schema: "",
                implements: [],
              }
            }
          },
          {
            uri: interface2Uri,
            plugin: {
              factory: () => ({} as Plugin),
              manifest: {
                schema: "",
                implements: [],
              }
            }
          }
        ],
        interfaces: [
          {
            interface: interface1Uri,
            implementations: [
              implementationUri
            ]
          },
          {
            interface: interface2Uri,
            implementations: [
              implementationUri
            ]
          },
          {
            interface: interface3Uri,
            implementations: [
              implementationUri
            ]
          }
        ]
      });
    }).toThrow(`Plugins can't use interfaces for their URI. Invalid plugins: ${[interface1Uri, interface2Uri]}`);
  });

  it("plugins should not get registered with an interface uri (with default plugins)", async () => {
    const interfaceUri = "w3://ens/some-interface.eth";

    const implementationUri = "w3://ens/some-implementation.eth";
    
    await expect(async () => {
      await getClient({
        plugins: [
          {
            uri: interfaceUri,
            plugin: {
              factory: () => ({} as Plugin),
              manifest: {
                schema: "",
                implements: [],
              }
            }
          }
        ],
        interfaces: [
          {
            interface: interfaceUri,
            implementations: [
              implementationUri
            ]
          }
        ]
      });
    })
    .rejects
    .toThrow(`Plugins can't use interfaces for their URI. Invalid plugins: ${[interfaceUri]}`);
  });

  it("get implementations - do not return plugins that are not explicitly registered", () => {
    const interfaceUri = "w3://ens/some-interface.eth";

    const implementation1Uri = "w3://ens/some-implementation1.eth";
    const implementation2Uri = "w3://ens/some-implementation2.eth";

    const client = new Web3ApiClient({
      plugins: [
        {
          uri: implementation1Uri,
          plugin: {
            factory: () => ({} as Plugin),
            manifest: {
              schema: '',
              implements: [new Uri(interfaceUri)],
            }
          }
        }
      ],
      interfaces: [
        {
          interface: interfaceUri,
          implementations: [
            implementation2Uri
          ]
        }
      ]
    });

    const getImplementationsResult = client.getImplementations(
        new Uri(interfaceUri),
        { applyRedirects: true }
      );
  
    expect(getImplementationsResult).toEqual([
      new Uri(implementation2Uri)
    ]);
  });

  it("get implementations - return implementations for plugins which don't have interface stated in manifest", () => {
    const interfaceUri = "w3://ens/some-interface.eth";

    const implementation1Uri = "w3://ens/some-implementation1.eth";
    const implementation2Uri = "w3://ens/some-implementation2.eth";

    const client = new Web3ApiClient({
      plugins: [
        {
          uri: implementation1Uri,
          plugin: {
            factory: () => ({} as Plugin),
            manifest: {
              schema: '',
              implements: [],
            }
          }
        }
      ], 
      interfaces: [
        {
          interface: interfaceUri,
          implementations: [
            implementation1Uri,
            implementation2Uri
          ]
        }
      ]
    });

    const getImplementationsResult = client.getImplementations(
      new Uri(interfaceUri),
      { applyRedirects: true }
    );

    expect(getImplementationsResult).toEqual([
      new Uri(implementation1Uri),
      new Uri(implementation2Uri)
    ]);
  });

  it("simple-storage", async () => {
    const api = await buildAndDeployApi(
      `${GetPathToTestApis()}/simple-storage`,
      ipfsProvider,
      ensAddress
    );

    const client = await getClient();

    const ensUri = `ens/testnet/${api.ensDomain}`;
    const ipfsUri = `ipfs/${api.ipfsCid}`;

    const deploy = await client.query<{
      deployContract: string;
    }>({
      uri: ensUri,
      query: `
        mutation {
          deployContract(
            connection: {
              networkNameOrChainId: "testnet"
            }
          )
        }
      `,
    });

    expect(deploy.errors).toBeFalsy();
    expect(deploy.data).toBeTruthy();
    expect(deploy.data?.deployContract.indexOf("0x")).toBeGreaterThan(-1);

    if (!deploy.data) {
      return;
    }

    const address = deploy.data.deployContract;
    const set = await client.query<{
      setData: string;
    }>({
      uri: ipfsUri,
      query: `
        mutation {
          setData(
            address: "${address}"
            value: $value
            connection: {
              networkNameOrChainId: "testnet"
            }
          )
        }
      `,
      variables: {
        value: 55,
      },
    });

    expect(set.errors).toBeFalsy();
    expect(set.data).toBeTruthy();
    expect(set.data?.setData.indexOf("0x")).toBeGreaterThan(-1);

    const getWithStringType = await client.query<{
      getData: number;
      secondGetData: number;
      thirdGetData: number;
    }>({
      uri: ensUri,
      query: `
        query {
          getData(
            address: "${address}"
            connection: {
              networkNameOrChainId: "testnet"
            }
          )
          secondGetData: getData(
            address: "${address}"
            connection: {
              networkNameOrChainId: "testnet"
            }
          )
          thirdGetData: getData(
            address: "${address}"
            connection: {
              networkNameOrChainId: "testnet"
            }
          )
        }
      `,
    });

    expect(getWithStringType.errors).toBeFalsy();
    expect(getWithStringType.data).toBeTruthy();
    expect(getWithStringType.data?.getData).toBe(55);
    expect(getWithStringType.data?.secondGetData).toBe(55);
    expect(getWithStringType.data?.thirdGetData).toBe(55);

    const getWithUriType = await client.query<{
      getData: number;
      secondGetData: number;
      thirdGetData: number;
    }>({
      uri: new Uri(ensUri),
      query: `
        query {
          getData(
            address: "${address}"
            connection: {
              networkNameOrChainId: "testnet"
            }
          )
          secondGetData: getData(
            address: "${address}"
            connection: {
              networkNameOrChainId: "testnet"
            }
          )
          thirdGetData: getData(
            address: "${address}"
            connection: {
              networkNameOrChainId: "testnet"
            }
          )
        }
      `,
    });

    expect(getWithUriType.errors).toBeFalsy();
    expect(getWithUriType.data).toBeTruthy();
    expect(getWithUriType.data?.getData).toBe(55);
    expect(getWithUriType.data?.secondGetData).toBe(55);
    expect(getWithUriType.data?.thirdGetData).toBe(55);
  });

  it("object-types", async () => {
    const api = await buildAndDeployApi(
      `${GetPathToTestApis()}/object-types`,
      ipfsProvider,
      ensAddress
    );
    const ensUri = `ens/testnet/${api.ensDomain}`;

    const client = await getClient();

    const method1a = await client.query<{
      method1: {
        prop: string;
        nested: {
          prop: string;
        };
      }[];
    }>({
      uri: ensUri,
      query: `
        query {
          method1(
            arg1: {
              prop: "arg1 prop"
              nested: {
                prop: "arg1 nested prop"
              }
            }
          )
        }
      `,
    });

    expect(method1a.errors).toBeFalsy();
    expect(method1a.data).toBeTruthy();
    expect(method1a.data).toMatchObject({
      method1: [
        {
          prop: "arg1 prop",
          nested: {
            prop: "arg1 nested prop",
          },
        },
        {
          prop: "",
          nested: {
            prop: "",
          },
        },
      ],
    });

    const method1b = await client.query<{
      method1: {
        prop: string;
        nested: {
          prop: string;
        };
      }[];
    }>({
      uri: ensUri,
      query: `
        query {
          method1(
            arg1: {
              prop: "arg1 prop"
              nested: {
                prop: "arg1 nested prop"
              }
            }
            arg2: {
              prop: "arg2 prop"
              circular: {
                prop: "arg2 circular prop"
              }
            }
          )
        }
      `,
    });

    expect(method1b.errors).toBeFalsy();
    expect(method1b.data).toBeTruthy();
    expect(method1b.data).toMatchObject({
      method1: [
        {
          prop: "arg1 prop",
          nested: {
            prop: "arg1 nested prop",
          },
        },
        {
          prop: "arg2 prop",
          nested: {
            prop: "arg2 circular prop",
          },
        },
      ],
    });

    const method2a = await client.query<{
      method2: {
        prop: string;
        nested: {
          prop: string;
        };
      } | null;
    }>({
      uri: ensUri,
      query: `
        query {
          method2(
            arg: {
              prop: "arg prop"
              nested: {
                prop: "arg nested prop"
              }
            }
          )
        }
      `,
    });

    expect(method2a.errors).toBeFalsy();
    expect(method2a.data).toBeTruthy();
    expect(method2a.data).toMatchObject({
      method2: {
        prop: "arg prop",
        nested: {
          prop: "arg nested prop",
        },
      },
    });

    const method2b = await client.query<{
      method2: {
        prop: string;
        nested: {
          prop: string;
        };
      } | null;
    }>({
      uri: ensUri,
      query: `
        query {
          method2(
            arg: {
              prop: "null"
              nested: {
                prop: "arg nested prop"
              }
            }
          )
        }
      `,
    });

    expect(method2b.errors).toBeFalsy();
    expect(method2b.data).toBeTruthy();
    expect(method2b.data).toMatchObject({
      method2: null,
    });

    const method3 = await client.query<{
      method3: ({
        prop: string;
        nested: {
          prop: string;
        };
      } | null)[];
    }>({
      uri: ensUri,
      query: `
        query {
          method3(
            arg: {
              prop: "arg prop"
              nested: {
                prop: "arg nested prop"
              }
            }
          )
        }
      `,
    });

    expect(method3.errors).toBeFalsy();
    expect(method3.data).toBeTruthy();
    expect(method3.data).toMatchObject({
      method3: [
        null,
        {
          prop: "arg prop",
          nested: {
            prop: "arg nested prop",
          },
        },
      ],
    });

    const method5 = await client.query<{
      method5: {
        prop: string;
        nested: {
          prop: string;
        };
      };
    }>({
      uri: ensUri,
      query: `
        query {
          method5(
            arg: {
              prop: [49, 50, 51, 52]
            }
          )
        }
      `,
    });

    expect(method5.errors).toBeFalsy();
    expect(method5.data).toBeTruthy();
    expect(method5.data).toMatchObject({
      method5: {
        prop: "1234",
        nested: {
          prop: "nested prop",
        },
      },
    });
  });

  it("bigint-type", async () => {
    const api = await buildAndDeployApi(
      `${GetPathToTestApis()}/bigint-type`,
      ipfsProvider,
      ensAddress
    );
    const ensUri = `ens/testnet/${api.ensDomain}`;

    const client = await getClient();

    {
      const response = await client.query<{
        method: string
      }>({
        uri: ensUri,
        query: `query {
          method(
            arg1: "123456789123456789"
            obj: {
              prop1: "987654321987654321"
            }
          )
        }`
      });

      const result = BigInt("123456789123456789") * BigInt("987654321987654321");

      expect(response.errors).toBeFalsy();
      expect(response.data).toBeTruthy();
      expect(response.data).toMatchObject({
        method: result.toString()
      });
    }

    {
      const response = await client.query<{
        method: string
      }>({
        uri: ensUri,
        query: `query {
          method(
            arg1: "123456789123456789"
            arg2: "123456789123456789123456789123456789"
            obj: {
              prop1: "987654321987654321"
              prop2: "987654321987654321987654321987654321"
            }
          )
        }`
      });

      const result = BigInt("123456789123456789")
        * BigInt("123456789123456789123456789123456789")
        * BigInt("987654321987654321")
        * BigInt("987654321987654321987654321987654321");

      expect(response.errors).toBeFalsy();
      expect(response.data).toBeTruthy();
      expect(response.data).toMatchObject({
        method: result.toString()
      });
    }
  });

  it("bytes-type", async () => {
    const api = await buildAndDeployApi(
      `${GetPathToTestApis()}/bytes-type`,
      ipfsProvider,
      ensAddress
    );
    const ensUri = `ens/testnet/${api.ensDomain}`;

    const client = await getClient();

    const response = await client.query<{
      bytesMethod: Buffer;
    }>({
      uri: ensUri,
      query: `
        query {
          bytesMethod(
            arg: {
              prop: $buffer
            }
          )
        }
      `,
      variables: {
        buffer: Buffer.from("Argument Value"),
      },
    });

    expect(response.errors).toBeFalsy();
    expect(response.data).toBeTruthy();
    expect(response.data).toMatchObject({
      bytesMethod: Buffer.from("Argument Value Sanity!").buffer,
    });
  });

  it("enum-types", async () => {
    const api = await buildAndDeployApi(
      `${GetPathToTestApis()}/enum-types`,
      ipfsProvider,
      ensAddress
    );
    const ensUri = `ens/testnet/${api.ensDomain}`;

    const client = await getClient();

    const method1a = await client.query<any>({
      uri: ensUri,
      query: `
        query {
          method1(
            en: 5
          )
        }
      `,
    });

    expect(method1a.errors).toBeTruthy();
    expect((method1a.errors as Error[])[0].message).toMatch(
      /__w3_abort: Invalid value for enum 'Enum': 5/gm
    );

    const method1b = await client.query<any>({
      uri: ensUri,
      query: `
        query {
          method1(
            en: 2
            optEnum: 1
          )
        }
      `,
    });

    expect(method1b.errors).toBeFalsy();
    expect(method1b.data).toBeTruthy();
    expect(method1b.data).toMatchObject({
      method1: 2,
    });

    const method1c = await client.query<any>({
      uri: ensUri,
      query: `
        query {
          method1(
            en: 1
            optEnum: INVALID
          )
        }
      `,
    });

    expect(method1c.errors).toBeTruthy();
    // @ts-ignore
    expect(method1c.errors[0].message).toMatch(
      /__w3_abort: Invalid key for enum 'Enum': INVALID/gm
    );

    const method2a = await client.query<any>({
      uri: ensUri,
      query: `
        query {
          method2(
            enumArray: [OPTION1, 0, OPTION3]
          )
        }
      `,
    });

    expect(method2a.errors).toBeFalsy();
    expect(method2a.data).toBeTruthy();
    expect(method2a.data).toMatchObject({
      method2: [0, 0, 2],
    });
  });

  it("should work with large types", async () => {
    const api = await buildAndDeployApi(
      `${GetPathToTestApis()}/large-types`,
      ipfsProvider,
      ensAddress
    );
    const ensUri = `ens/testnet/${api.ensDomain}`;
    const client = await getClient();

    const largeStr = new Array(10000).join("web3api ")
    const largeBytes = new Uint8Array(Buffer.from(largeStr));
    const largeStrArray = [];
    const largeBytesArray = [];

    for (let i=0; i<100; i++) {
      largeStrArray.push(largeStr);
      largeBytesArray.push(largeBytes);
    }

    const largeTypesMethodCall = await client.query<any>({
      uri: ensUri,
      query: `
        query {
          method(
            largeCollection: {
              largeStr: $largeStr
              largeBytes: $largeBytes
              largeStrArray: $largeStrArray
              largeBytesArray: $largeBytesArray
            }
          )
        }
      `,
      variables: {
        largeStr: largeStr,
        largeBytes: largeBytes,
        largeStrArray: largeStrArray,
        largeBytesArray: largeBytesArray,
      }
    });

    expect(largeTypesMethodCall.data).toBeTruthy();
    expect(largeTypesMethodCall.data).toEqual({
      method: {
        largeStr: largeStr,
        largeBytes: largeBytes,
        largeStrArray: largeStrArray,
        largeBytesArray: largeBytesArray
      }
    });
  });

  it("number-types under and overflows", async () => {
    const api = await buildAndDeployApi(
      `${GetPathToTestApis()}/number-types`,
      ipfsProvider,
      ensAddress
    );
    const ensUri = `ens/testnet/${api.ensDomain}`;
    const client = await getClient();

    const i8Underflow = await client.query<{
      i8Method: number
    }>({
      uri: ensUri,
      query: `
      query {
        i8Method(
          first: $firstInt
          second: $secondInt
        )
      }
    `,
      variables: {
        firstInt: -129, // min i8 = -128
        secondInt: 10
      }
    });
    expect(i8Underflow.errors).toBeTruthy();
    expect(i8Underflow.errors?.[0].message).toMatch(
      /integer overflow: value = -129; bits = 8/
    );
    expect(i8Underflow.data?.i8Method).toBeUndefined();

    const u8Overflow = await client.query<{
      u8Method: number
    }>({
      uri: ensUri,
      query: `
        query {
          u8Method(
            first: $firstInt
            second: $secondInt
          )
        }
      `,
      variables: {
        firstInt: 256, // max u8 = 255
        secondInt: 10
      }
    });
    expect(u8Overflow.errors).toBeTruthy();
    expect(u8Overflow.errors?.[0].message).toMatch(
      /unsigned integer overflow: value = 256; bits = 8/
    );
    expect(u8Overflow.data?.u8Method).toBeUndefined();

    const i16Underflow = await client.query<{
      i16Method: number
    }>({
      uri: ensUri,
      query: `
      query {
        i16Method(
          first: $firstInt
          second: $secondInt
        )
      }
    `,
      variables: {
        firstInt: -32769, // min i16 = -32768
        secondInt: 10
      }
    });
    expect(i16Underflow.errors).toBeTruthy();
    expect(i16Underflow.errors?.[0].message).toMatch(
      /integer overflow: value = -32769; bits = 16/
    );
    expect(i16Underflow.data?.i16Method).toBeUndefined();

    const u16Overflow = await client.query<{
      u16Method: number
    }>({
      uri: ensUri,
      query: `
        query {
          u16Method(
            first: $firstInt
            second: $secondInt
          )
        }
      `,
      variables: {
        firstInt: 65536, // max u16 = 65535
        secondInt: 10
      }
    });
    expect(u16Overflow.errors).toBeTruthy();
    expect(u16Overflow.errors?.[0].message).toMatch(
      /unsigned integer overflow: value = 65536; bits = 16/
    );
    expect(u16Overflow.data?.u16Method).toBeUndefined();

    const i32Underflow = await client.query<{
      i32Method: number
    }>({
      uri: ensUri,
      query: `
      query {
        i32Method(
          first: $firstInt
          second: $secondInt
        )
      }
    `,
      variables: {
        firstInt: -2147483649, // min i32 = -2147483648
        secondInt: 10
      }
    });
    expect(i32Underflow.errors).toBeTruthy();
    expect(i32Underflow.errors?.[0].message).toMatch(
      /integer overflow: value = -2147483649; bits = 32/
    );
    expect(i32Underflow.data?.i32Method).toBeUndefined();

    const u32Overflow = await client.query<{
      u32Method: number
    }>({
      uri: ensUri,
      query: `
        query {
          u32Method(
            first: $firstInt
            second: $secondInt
          )
        }
      `,
      variables: {
        firstInt: 4294967296, // max u32 = 4294967295
        secondInt: 10
      }
    });
    expect(u32Overflow.errors).toBeTruthy();
    expect(u32Overflow.errors?.[0].message).toMatch(
      /unsigned integer overflow: value = 4294967296; bits = 32/
    );
    expect(u32Overflow.data?.u32Method).toBeUndefined();
  });

  it("invalid type errors", async () => {
    const api = await buildAndDeployApi(
      `${GetPathToTestApis()}/invalid-types`,
      ipfsProvider,
      ensAddress
    );
    const ensUri = `ens/testnet/${api.ensDomain}`;
    const client = await getClient();

    const invalidBoolIntSent = await client.query({
      uri: ensUri,
      query: `
      query {
        boolMethod(
          arg: $integer
        )
      }
    `,
      variables: {
        integer: 10
      }
    });
    expect(invalidBoolIntSent.errors).toBeTruthy();
    expect(invalidBoolIntSent.errors?.[0].message).toMatch(
      /Property must be of type 'bool'. Found 'int'./
    );

    const invalidIntBoolSent = await client.query({
      uri: ensUri,
      query: `
      query {
        intMethod(
          arg: $bool
        )
      }
    `,
      variables: {
        bool: true
      }
    });
    expect(invalidIntBoolSent.errors).toBeTruthy();
    expect(invalidIntBoolSent.errors?.[0].message).toMatch(
      /Property must be of type 'int'. Found 'bool'./
    );

    const invalidUIntArraySent = await client.query({
      uri: ensUri,
      query: `
      query {
        uIntMethod(
          arg: $array
        )
      }
    `,
      variables: {
        array: [10]
      }
    });
    expect(invalidUIntArraySent.errors).toBeTruthy();
    expect(invalidUIntArraySent.errors?.[0].message).toMatch(
      /Property must be of type 'uint'. Found 'array'./
    );

    const invalidBytesFloatSent = await client.query({
      uri: ensUri,
      query: `
      query {
        bytesMethod(
          arg: $float
        )
      }
    `,
      variables: {
        float: 10.15
      }
    });
    expect(invalidBytesFloatSent.errors).toBeTruthy();
    expect(invalidBytesFloatSent.errors?.[0].message).toMatch(
      /Property must be of type 'bytes'. Found 'float64'./
    );

    const invalidArrayMapSent = await client.query({
      uri: ensUri,
      query: `
      query {
        arrayMethod(
          arg: $object
        )
      }
    `,
      variables: {
        object: {
          prop: "prop"
        }
      }
    });
    expect(invalidArrayMapSent.errors).toBeTruthy();
    expect(invalidArrayMapSent.errors?.[0].message).toMatch(
      /Property must be of type 'array'. Found 'map'./
    );
  });

  it("loadWeb3Api - pass string or Uri", async () => {
    const implementationUri = "w3://ens/some-implementation.eth";
    const schemaStr = "test-schema";
    
    const client = new Web3ApiClient({
        plugins: [
          {
            uri: implementationUri,
            plugin: {
              factory: () => ({} as Plugin),
              manifest: {
                schema: schemaStr,
                implements: [],
              }
            }
          }
        ]
      });
      
    const apiWhenString = await client.loadWeb3Api(implementationUri);
    const apiWhenUri = await client.loadWeb3Api(new Uri(implementationUri));

    const schemaWhenString = await apiWhenString.getSchema(client);
    const schemaWhenUri = await apiWhenUri.getSchema(client);

    expect(schemaWhenString).toEqual(schemaStr);
    expect(schemaWhenUri).toEqual(schemaStr);
  });

  it("getImplementations - pass string or Uri", async () => {
    const oldInterfaceUri = "ens/old.eth";
    const newInterfaceUri = "ens/new.eth";

    const implementation1Uri = "w3://ens/some-implementation1.eth";
    const implementation2Uri = "w3://ens/some-implementation2.eth";

    const client = new Web3ApiClient({
      redirects: [
        {
          from: oldInterfaceUri,
          to: newInterfaceUri
        }
      ],
      interfaces: [
        {
          interface: oldInterfaceUri,
          implementations: [
            implementation1Uri,
          ]
        },
        {
          interface: newInterfaceUri,
          implementations: [
            implementation2Uri,
          ]
        }
      ]
    });
    
    let result = client.getImplementations(oldInterfaceUri);
    expect(result).toEqual([implementation1Uri]);
    
    result = client.getImplementations(oldInterfaceUri, { applyRedirects: true });
    expect(result).toEqual([implementation1Uri, implementation2Uri]);

    let result2 = client.getImplementations(new Uri(oldInterfaceUri));
    expect(result2).toEqual([new Uri(implementation1Uri)]);
    
    result2 = client.getImplementations(new Uri(oldInterfaceUri), { applyRedirects: true });
    expect(result2).toEqual([new Uri(implementation1Uri), new Uri(implementation2Uri)]);
  });

  it("e2e interface implementations", async () => {
    let interfaceApi = await buildAndDeployApi(
      `${GetPathToTestApis()}/implementations/test-interface`,
      ipfsProvider,
      ensAddress
    );
    const interfaceUri = `w3://ens/testnet/${interfaceApi.ensDomain}`;

    const implementationApi = await buildAndDeployApi(
      `${GetPathToTestApis()}/implementations/test-api`,
      ipfsProvider,
      ensAddress
    );
    const implementationUri = `w3://ens/testnet/${implementationApi.ensDomain}`;

    const client = await getClient({
      interfaces: [
        {
          interface: interfaceUri,
          implementations: [
            implementationUri
          ]
        }
      ]
    });

    expect(
      client.getImplementations(interfaceUri)
      )
    .toEqual([implementationUri]);

    const query = await client.query<{
      queryMethod: string;
      abstractQueryMethod: string;
    }>({
      uri: implementationUri,
      query: `
        query {
          queryMethod(
            arg: $argument1
          )
          abstractQueryMethod(
            arg: $argument2
          )
        }
      `,
      variables: {
        argument1: {
          uint8: 1,
          str: "Test String 1"
        },
        argument2: {
          str: "Test String 2"
        }
      }
    });

    expect(query.errors).toBeFalsy();
    expect(query.data).toBeTruthy();
    expect(query.data?.queryMethod).toEqual({
      uint8: 1,
      str: "Test String 1"
    });

    expect(query.data?.abstractQueryMethod).toBe("Test String 2");

    const mutation = await client.query<{
      mutationMethod: string;
      abstractMutationMethod: string;
    }>({
      uri: implementationUri,
      query: `
      mutation {
          mutationMethod(
            arg: $argument1
          )
          abstractMutationMethod(
            arg: $argument2
          )
        }
      `,
      variables: {
        argument1: 1,
        argument2: 2
      }
    });

    expect(mutation.errors).toBeFalsy();
    expect(mutation.data).toBeTruthy();
    expect(mutation.data?.mutationMethod).toBe(1);
    expect(mutation.data?.abstractMutationMethod).toBe(2);
  });

  it("simple-storage: subscribe", async () => {
    const api = await buildAndDeployApi(
      `${GetPathToTestApis()}/simple-storage`,
      ipfsProvider,
      ensAddress
    );

    const client = await getClient();

    const ensUri = `ens/testnet/${api.ensDomain}`;
    const ipfsUri = `ipfs/${api.ipfsCid}`;

    const deploy = await client.query<{
      deployContract: string;
    }>({
      uri: ensUri,
      query: `
        mutation {
          deployContract(
            connection: {
              networkNameOrChainId: "testnet"
            }
          )
        }
      `,
    });

    expect(deploy.errors).toBeFalsy();
    expect(deploy.data).toBeTruthy();
    expect(deploy.data?.deployContract.indexOf("0x")).toBeGreaterThan(-1);

    const address = deploy.data?.deployContract;

    // test subscription
    let results: number[] = [];
    let value = 0;

    const setter = setInterval(async() => {
      await client.query<{
        setData: string;
      }>({
        uri: ipfsUri,
        query: `
        mutation {
          setData(
            address: $address
            value: $value
            connection: {
              networkNameOrChainId: "testnet"
            }
          )
        }
      `,
        variables: {
          address: address,
          value: value++,
        },
      });
    }, 4000);

    const getSubscription: Subscription<{
      getData: number;
    }> = client.subscribe<{
      getData: number;
    }>({
      uri: ensUri,
      query: `
        query {
          getData(
            address: $address
            connection: {
              networkNameOrChainId: "testnet"
            }
          )
        }
      `,
      variables: {
        address
      },
      frequency: { ms: 4500 }
    });

    for await (let query of getSubscription) {
      expect(query.errors).toBeFalsy();
      const val = query.data?.getData;
      if (val !== undefined) {
        results.push(val);
        if (val >= 2) {
          break;
        }
      }
    }
    clearInterval(setter);

    expect(results).toStrictEqual([0, 1, 2]);
  });

  it("simple-storage: subscription early stop", async () => {
    const api = await buildAndDeployApi(
      `${GetPathToTestApis()}/simple-storage`,
      ipfsProvider,
      ensAddress
    );

    const client = await getClient();

    const ensUri = `ens/testnet/${api.ensDomain}`;
    const ipfsUri = `ipfs/${api.ipfsCid}`;

    const deploy = await client.query<{
      deployContract: string;
    }>({
      uri: ensUri,
      query: `
        mutation {
          deployContract(
            connection: {
              networkNameOrChainId: "testnet"
            }
          )
        }
      `,
    });

    expect(deploy.errors).toBeFalsy();
    expect(deploy.data).toBeTruthy();
    expect(deploy.data?.deployContract.indexOf("0x")).toBeGreaterThan(-1);

    const address = deploy.data?.deployContract;

    // test subscription
    let results: number[] = [];
    let value = 0;

    const setter = setInterval(async() => {
      await client.query<{
        setData: string;
      }>({
        uri: ipfsUri,
        query: `
          mutation {
            setData(
              address: $address
              value: $value
              connection: {
                networkNameOrChainId: "testnet"
              }
            )
          }
        `,
        variables: {
          address: address,
          value: value++,
        },
      });
    }, 4000);

    const getSubscription: Subscription<{
      getData: number;
    }> = client.subscribe<{
      getData: number;
    }>({
      uri: ensUri,
      query: `
          query {
            getData(
              address: $address
              connection: {
                networkNameOrChainId: "testnet"
              }
            )
          }
        `,
      variables: {
        address
      },
      frequency: { ms: 4500 }
    });

    new Promise(async () => {
        for await (let query of getSubscription) {
          expect(query.errors).toBeFalsy();
          const val = query.data?.getData;
          if (val !== undefined) {
            results.push(val);
            if (val >= 2) {
              break;
            }
          }
        }
      }
    );
    await new Promise(r => setTimeout(r, 8000));
    getSubscription.stop();
    clearInterval(setter);

    expect(results).toContain(0);
    expect(results).not.toContain(2);
  });
});
