const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("HyperVault", function () {
  async function deployFixture() {
    const [owner, user] = await ethers.getSigners();

    const WrappedPAS = await ethers.getContractFactory("WrappedPAS");
    const dot = await WrappedPAS.deploy();
    await dot.waitForDeployment();

    const BuildCallData = await ethers.getContractFactory("BuildCallData");
    const buildCallData = await BuildCallData.deploy();
    await buildCallData.waitForDeployment();

    const HyperVault = await ethers.getContractFactory("HyperVault", {
      libraries: {
        BuildCallData: await buildCallData.getAddress(),
      },
    });

    const vault = await HyperVault.deploy(
      await dot.getAddress(),
      ethers.ZeroHash,
      false
    );
    await vault.waitForDeployment();

    // Provide balances for testing and extra vault liquidity for mock-yield payouts.
    await dot.connect(user).deposit({ value: ethers.parseEther("20") });
    await dot.connect(owner).deposit({ value: ethers.parseEther("5") });
    await dot.connect(owner).transfer(await vault.getAddress(), ethers.parseEther("5"));

    return { owner, user, dot, vault };
  }

  it("mints shares on deposit and tracks user state", async function () {
    const { user, dot, vault } = await loadFixture(deployFixture);
    const depositAmount = ethers.parseEther("10");

    await dot.connect(user).approve(await vault.getAddress(), depositAmount);

    await expect(vault.connect(user).deposit(depositAmount))
      .to.emit(vault, "Deposited")
      .withArgs(user.address, depositAmount, depositAmount, ethers.parseUnits("1", 18));

    const userInfo = await vault.getUserInfo(user.address);
    expect(userInfo._shares).to.equal(depositAmount);
    expect(userInfo._dotValue).to.equal(depositAmount);
    expect(userInfo._pendingWithdrawal).to.equal(0);

    const state = await vault.getVaultState();
    expect(state._totalDotDeposited).to.equal(depositAmount);
    expect(state._totalShares).to.equal(depositAmount);
    expect(state._xcmEnabled).to.equal(false);
  });

  it("returns principal plus mock yield on withdraw in fallback mode", async function () {
    const { user, dot, vault } = await loadFixture(deployFixture);
    const depositAmount = ethers.parseEther("10");

    await dot.connect(user).approve(await vault.getAddress(), depositAmount);
    await vault.connect(user).deposit(depositAmount);

    const balanceAfterDeposit = await dot.balanceOf(user.address);
    expect(balanceAfterDeposit).to.equal(ethers.parseEther("10"));

    // One year so mock APY has time to accrue.
    await time.increase(365 * 24 * 60 * 60);

    await expect(vault.connect(user).withdraw(depositAmount))
      .to.emit(vault, "WithdrawalCompleted");

    const balanceAfterWithdraw = await dot.balanceOf(user.address);
    expect(balanceAfterWithdraw).to.be.greaterThan(balanceAfterDeposit);
    expect(balanceAfterWithdraw).to.be.greaterThan(ethers.parseEther("11"));

    const stateAfter = await vault.getVaultState();
    expect(stateAfter._totalShares).to.equal(0);
  });

  it("allows owner to set hub sovereign and blocks non-owner", async function () {
    const { owner, user, vault } = await loadFixture(deployFixture);
    const newSovereign = "0x" + "11".repeat(32);

    await expect(vault.connect(user).setHubSovereign(newSovereign))
      .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");

    await expect(vault.connect(owner).setHubSovereign(newSovereign))
      .to.emit(vault, "HubSovereignUpdated")
      .withArgs(newSovereign);

    expect(await vault.hubSovereign()).to.equal(newSovereign);
  });
});
