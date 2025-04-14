require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.21",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100, 
      },
    },
  },
  networks: {
    sepolia: {
      url: "https://sepolia.infura.io/v3/ea182952cb374d3ea842589f8722c7cc",
      accounts: ["ToDO Private Keys eintragen","ToDO Private Keys eintragen", "ToDO Private Keys eintragen"], // Private Keys der Wallets
    },
  },
};