require("@nomicfoundation/hardhat-chai-matchers")
require("@nomiclabs/hardhat-ethers")
require("@nomicfoundation/hardhat-verify");
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()
require("mocha")

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY


module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      blockConfirmations: 1,
    },
    sepolia: {
      chainId: 11155111,
      blockConfirmations: 6,
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
    }
  },etherscan: {
    
    apiKey: {
        sepolia: ETHERSCAN_API_KEY,
    },
    customChains: [
        {
            network: "goerli",
            chainId: 5,
            urls: {
                apiURL: "https://api-goerli.etherscan.io/api",
                browserURL: "https://goerli.etherscan.io",
            },
        },
    ],
  },
  gasReporter: {
    enabled: false,
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
  },
  solidity: "0.8.7",
  namedAccounts: {
    deployer: {
      default: 0,
    },
    player: {
      default: 1,
    },
  },
  mocha: {
    timeout: 500000 //200 seconds max
  }
}

