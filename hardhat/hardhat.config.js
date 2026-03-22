require("@nomicfoundation/hardhat-toolbox");

require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "paris"
    }
  },
  networks: {
    polkadotTestnet: {
      url: process.env.POLKADOT_TESTNET_RPC_URL || "https://services.polkadothub-rpc.com/testnet",
      chainId: 420420417,
      accounts: process.env.PRIVATE_KEY 
        ? [process.env.PRIVATE_KEY.trim().startsWith("0x") ? process.env.PRIVATE_KEY.trim() : "0x" + process.env.PRIVATE_KEY.trim()] 
        : [],
    }
  }
};
