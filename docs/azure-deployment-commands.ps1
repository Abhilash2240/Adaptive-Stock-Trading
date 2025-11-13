# Azure deployment automation script for Adaptive-Stock-Trading
# Usage: review and customize variables before running

# --- Configuration ---
$RESOURCE_GROUP = "rg-stocktrade"
$LOCATION = "eastus"
$SWA_NAME = "swa-stocktrade$(Get-Random -Maximum 9999)"
$ACR_NAME = "acrstocktrade$(Get-Random -Maximum 9999)"
$ACA_ENV = "env-stocktrade"
$ACA_APP = "api-stocktrade"
$LOG_WS = "log-stocktrade"
$KV_NAME = "kv-stocktrade$(Get-Random -Maximum 9999)"
$GITHUB_REPO = "<your-github-account>/Adaptive-Stock-Trading"
$CONTAINER_IMAGE_TAG = "latest"
$BACKEND_IMAGE = "$($ACR_NAME).azurecr.io/stocktrade-api:$CONTAINER_IMAGE_TAG"

# --- Login ---
az login
# Optionally select subscription if you have more than one
ez account set --subscription "Azure for Students"

# --- Resource provisioning ---
az group create --name $RESOURCE_GROUP --location $LOCATION

az monitor log-analytics workspace create `
  --resource-group $RESOURCE_GROUP `
  --workspace-name $LOG_WS `
  --location $LOCATION

$WORKSPACE_ID = az monitor log-analytics workspace show `
  --resource-group $RESOURCE_GROUP `
  --workspace-name $LOG_WS `
  --query id --output tsv

$WORKSPACE_KEY = az monitor log-analytics workspace get-shared-keys `
  --resource-group $RESOURCE_GROUP `
  --workspace-name $LOG_WS `
  --query primarySharedKey --output tsv

az containerapp env create `
  --name $ACA_ENV `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION `
  --logs-workspace-id $WORKSPACE_ID `
  --logs-workspace-key $WORKSPACE_KEY

az acr create `
  --resource-group $RESOURCE_GROUP `
  --name $ACR_NAME `
  --sku Basic `
  --location $LOCATION

az keyvault create `
  --name $KV_NAME `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION

az staticwebapp create `
  --name $SWA_NAME `
  --resource-group $RESOURCE_GROUP `
  --source https://github.com/$GITHUB_REPO `
  --branch main `
  --location $LOCATION `
  --app-location "apps/client" `
  --output-location "dist" `
  --login-with-azure `
  --sku Free

# --- Backend image build & push ---
az acr login --name $ACR_NAME

docker build `
  --file backend/Dockerfile `
  --tag $BACKEND_IMAGE `
  .

docker push $BACKEND_IMAGE

# --- Container App bootstrap to capture identity ---
az containerapp create `
  --name $ACA_APP `
  --resource-group $RESOURCE_GROUP `
  --environment $ACA_ENV `
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest `
  --target-port 8080 `
  --ingress external `
  --min-replicas 1

$IDENTITY_ID = az containerapp show `
  --name $ACA_APP `
  --resource-group $RESOURCE_GROUP `
  --query "identity.principalId" --output tsv

az keyvault set-policy `
  --name $KV_NAME `
  --object-id $IDENTITY_ID `
  --secret-permissions get list

# --- Secrets ---
# Replace PLACEHOLDER with actual values
az keyvault secret set `
  --vault-name $KV_NAME `
  --name "PolygonApiKey" `
  --value "<REPLACE_WITH_REAL_POLYGON_KEY>"

az containerapp secret set `
  --name $ACA_APP `
  --resource-group $RESOURCE_GROUP `
  --secrets polygon-key=secretref://$KV_NAME/PolygonApiKey

# --- Deploy backend to Container Apps ---
az containerapp update `
  --name $ACA_APP `
  --resource-group $RESOURCE_GROUP `
  --image $BACKEND_IMAGE `
  --target-port 8080 `
  --ingress external `
  --min-replicas 1 `
  --max-replicas 5 `
  --scale-rule-name http-scaling `
  --scale-rule-type http `
  --scale-rule-http-concurrency 50 `
  --environment-variables "POLYGON_API_KEY=secretref:polygon-key" "ENVIRONMENT=production" `
  --registry-identity system `
  --registry-server "$($ACR_NAME).azurecr.io"

# --- Output backend FQDN for SWA routing ---
$API_FQDN = az containerapp show `
  --name $ACA_APP `
  --resource-group $RESOURCE_GROUP `
  --query "properties.configuration.ingress.fqdn" --output tsv

Write-Host "Container App URL: https://$API_FQDN"
Write-Host "Remember to update apps/client/routes.json to proxy to this FQDN."

Write-Host "Azure Static Web Apps deployment runs via GitHub Actions. Push changes and monitor the workflow."