{
  description = "A basic flake with a shell";
  inputs.nixpkgs.url = "github:nixos/nixpkgs/nixos-24.11";
  inputs.systems.url = "github:nix-systems/default";
  inputs.flake-utils = {
    url = "github:numtide/flake-utils";
    inputs.systems.follows = "systems";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        defaultOpts = {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        pinnedVscode =
          (import (builtins.fetchGit {
            # Descriptive name to make the store path easier to identify
            name = "pinned-vscode";
            url = "https://github.com/NixOS/nixpkgs/";
            ref = "refs/heads/nixpkgs-unstable";
            rev = "0c19708cf035f50d28eb4b2b8e7a79d4dc52f6bb";
          }) defaultOpts).vscode;
      in
      {
        devShells.default = pkgs.mkShell {
          shellHook = ''
            export VSCODE_TEST_BIN_PATH=${pinnedVscode}/lib/vscode/code
          '';
        };
      }
    );
}