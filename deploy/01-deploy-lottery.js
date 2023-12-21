const { getNamedAccounts, deployments, network, ethers } = require("hardhat");
const { developmentChains, networkConfig, verify } = require("../helper-hardhat-config");

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("30")

module.exports = async function({getNamedAccounts, deployments}) {
    const { deploy, log } = deployments;
    const {deployer} = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock

    if(developmentChains.includes(network.name)){
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = await vrfCoordinatorV2Mock.getAddress()
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionId = BigInt(transactionReceipt.logs[0].topics[1])

        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]

    const args = [vrfCoordinatorV2Address, entranceFee, gasLane, subscriptionId, callbackGasLimit, interval]
    const lottery = await deploy("Lottery", {
        from: deployer, 
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if(developmentChains.includes(network.name)) {
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, lottery.address)
        log('Consumer is added')
    }

    if(!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(lottery.address, args)
    }
    log("-------------------------------------")

}

module.exports.tags = ["all", "lottery"]