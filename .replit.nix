# Minimal configuration to reduce resource usage
{ pkgs }: {
  deps = [
    pkgs.nodejs-20_x
    pkgs.postgresql
  ];
  
  # Reduce language server overhead
  env = {
    NODE_ENV = "development";
    DISABLE_TYPESCRIPT_LANGUAGE_SERVER = "true";
  };
}