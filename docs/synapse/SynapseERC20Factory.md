



  # Functions:
      - [`deploy(address synapseERC20Address, string name, string symbol, uint256 underlyingChainId, address underlyingTokenAddress, uint8 decimals, address owner)`](#SynapseERC20Factory-deploy-address-string-string-uint256-address-uint8-address-)

  # Events:
    - [`SynapseERC20Created(address contractAddress)`](#SynapseERC20Factory-SynapseERC20Created-address-)

    # Function `deploy(address synapseERC20Address, string name, string symbol, uint256 underlyingChainId, address underlyingTokenAddress, uint8 decimals, address owner) → address` {#SynapseERC20Factory-deploy-address-string-string-uint256-address-uint8-address-}
    Deploys a new node 

    
      ## Parameters:
        - `synapseERC20Address`:
        address of the synapseERC20Address contract to initialize with

        - `name`:
        Token name

        - `symbol`:
        Token symbol

        - `decimals`:
        Token name

        - `underlyingChainId`:
        Base asset chain ID which SynapseERC20 represents 

        - `underlyingTokenAddress`:
        Base asset address which SynapseERC20 represents 

        - `owner`:
        admin address to be initialized with

      ## Return Values:
        -
        Address
        of the newest node management contract created


  # Event `SynapseERC20Created(address contractAddress)` {#SynapseERC20Factory-SynapseERC20Created-address-}
  No description
  