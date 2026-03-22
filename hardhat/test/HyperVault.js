const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("HyperVault", function () {
  async function deployFixture(xcmEnabled = false) {
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
      xcmEnabled
    );
    await vault.waitForDeployment();

    // Provide balances for testing and extra vault liquidity for mock-yield payouts.
    await dot.connect(user).deposit({ value: ethers.parseEther("20") });
    await dot.connect(owner).deposit({ value: ethers.parseEther("5") });
    await dot.connect(owner).transfer(await vault.getAddress(), ethers.parseEther("5"));

    return { owner, user, dot, vault };
  }

  async function deployLiveWithoutConfigFixture() {
    return deployFixture(true);
  }

  async function deployNativeFixture(xcmEnabled = false) {
    const [owner, user] = await ethers.getSigners();

    const BuildCallData = await ethers.getContractFactory("BuildCallData");
    const buildCallData = await BuildCallData.deploy();
    await buildCallData.waitForDeployment();

    const HyperVault = await ethers.getContractFactory("HyperVault", {
      libraries: {
        BuildCallData: await buildCallData.getAddress(),
      },
    });

    const vault = await HyperVault.deploy(
      ethers.ZeroAddress,
      ethers.ZeroHash,
      xcmEnabled
    );
    await vault.waitForDeployment();

    // Extra vault liquidity for mock yield payouts in native mode.
    await owner.sendTransaction({
      to: await vault.getAddress(),
      value: ethers.parseUnits("5", 10),
    });

    return { owner, user, vault };
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

  it("falls back to 10 decimals when token metadata is unavailable", async function () {
    const TokenNoMetadata = await ethers.getContractFactory("TokenNoMetadata");
    const token = await TokenNoMetadata.deploy();
    await token.waitForDeployment();

    const BuildCallData = await ethers.getContractFactory("BuildCallData");
    const buildCallData = await BuildCallData.deploy();
    await buildCallData.waitForDeployment();

    const HyperVault = await ethers.getContractFactory("HyperVault", {
      libraries: {
        BuildCallData: await buildCallData.getAddress(),
      },
    });

    const vault = await HyperVault.deploy(
      await token.getAddress(),
      ethers.ZeroHash,
      false
    );
    await vault.waitForDeployment();
    expect(await vault.dotDecimals()).to.equal(10);
  });

  it("reverts deposits in live mode when XCM config is missing", async function () {
    const { user, dot, vault } = await loadFixture(deployLiveWithoutConfigFixture);
    const depositAmount = ethers.parseEther("1");

    await dot.connect(user).approve(await vault.getAddress(), depositAmount);

    await expect(vault.connect(user).deposit(depositAmount))
      .to.be.revertedWithCustomError(vault, "XcmNotConfigured");
  });

  it("treats CHANNEL_ID=0 as valid live config and disables mock yield estimates", async function () {
    const { owner, user, dot, vault } = await loadFixture(deployFixture);
    const depositAmount = ethers.parseEther("2");

    await dot.connect(user).approve(await vault.getAddress(), depositAmount);
    await vault.connect(user).deposit(depositAmount);

    // Live config with channelId = 0 should still count as live.
    await vault.connect(owner).setXcmConfig(
      "0x0800",
      "0x0900",
      "0x01",
      "HyperVault",
      0,
      true
    );

    await time.increase(365 * 24 * 60 * 60);

    const estimatedYield = await vault.getEstimatedYield(user.address);
    expect(estimatedYield).to.equal(0);
  });

  it("supports canonical native mode deposits and withdrawals", async function () {
    const { user, vault } = await loadFixture(deployNativeFixture);
    const depositAmount = ethers.parseUnits("10", 10);
    const vaultAddress = await vault.getAddress();
    await expect(
      vault.connect(user).deposit(depositAmount, { value: depositAmount })
    ).to.emit(vault, "Deposited");

    const state = await vault.getVaultState();
    expect(state._totalDotDeposited).to.equal(depositAmount);
    expect(state._totalShares).to.equal(ethers.parseUnits("10", 18));

    await time.increase(365 * 24 * 60 * 60);
    await expect(vault.connect(user).withdraw(ethers.parseUnits("10", 18)))
      .to.emit(vault, "WithdrawalCompleted");

    const userInfoAfter = await vault.getUserInfo(user.address);
    const stateAfter = await vault.getVaultState();
    const vaultBalanceAfter = await ethers.provider.getBalance(vaultAddress);

    expect(userInfoAfter._shares).to.equal(0);
    expect(stateAfter._totalShares).to.equal(0);
    expect(vaultBalanceAfter).to.be.lessThan(ethers.parseUnits("5", 10));
  });

  it("rejects mismatched msg.value in native mode", async function () {
    const { user, vault } = await loadFixture(deployNativeFixture);
    const amount = ethers.parseUnits("1", 10);

    await expect(
      vault.connect(user).deposit(amount, { value: amount - 1n })
    ).to.be.revertedWithCustomError(vault, "InvalidNativeDeposit");
  });
});
