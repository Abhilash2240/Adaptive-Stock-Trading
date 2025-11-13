# Azure Deployment Guide

This walkthrough turns the project into a production-ready deployment on Azure. Follow the steps in order; every command assumes Windows PowerShell and the repository root as the working directory.

> **High-level architecture**
>
> - **Frontend**: Vite/React app, deployed to **Azure Static Web Apps** (SWA). SWA also proxies API calls to the backend and handles global CDN + authentication hooks.
> - **Backend**: FastAPI service packaged as a container, deployed to **Azure Container Apps** (ACA). The container image lives in **Azure Container Registry** (ACR).
> - **Observability**: **Log Analytics workspace** (required by ACA) + optional **Application Insights**.
> - **Configuration**: Secrets and connection strings stored in **Azure Key Vault**; environment variables injected into ACA and SWA build.

## 1. Prerequisites

1. Install the Azure CLI and sign in:
   ```powershell
   winget install -e --id Microsoft.AzureCLI
   az login
   ```
2. Install the Azure Developer CLI extension needed for Container Apps:
   ```powershell
   az extension add --name containerapp --upgrade
   az extension add --name application-insights --upgrade
   ```
3. (Optional but recommended) Install Docker Desktop to build and tag container images locally.
4. Set a few reusable variables in your PowerShell session:
   ```powershell
   $RESOURCE_GROUP="rg-stocktrade"         # change as desired
   $LOCATION="eastus"                      # pick the closest region
   $SWA_NAME="swa-stocktrade-$(Get-Random -Maximum 9999)"
   $ACR_NAME="acrstocktrade$(Get-Random -Maximum 9999)"
   $ACA_ENV="env-stocktrade"
   $ACA_APP="api-stocktrade"
   $LOG_WS="log-stocktrade"
   $KV_NAME="kv-stocktrade-$(Get-Random -Maximum 9999)"
   ```

## 2. Provision Azure resources

1. Create the resource group:
   ```powershell
   az group create --name $RESOURCE_GROUP --location $LOCATION
   ```
2. Create the Log Analytics workspace (ACA dependency):
   ```powershell
   az monitor log-analytics workspace create `
     --resource-group $RESOURCE_GROUP `
     --workspace-name $LOG_WS `
     --location $LOCATION
   ```
3. Create Azure Container Registry (ACR):
   ```powershell
   az acr create `
     --resource-group $RESOURCE_GROUP `
     --name $ACR_NAME `
     --sku Basic `
     --location $LOCATION
   ```
4. Create Azure Key Vault for secrets:
   ```powershell
   az keyvault create `
     --name $KV_NAME `
     --resource-group $RESOURCE_GROUP `
     --location $LOCATION
   ```
5. Create the Container Apps environment:
   ```powershell
   $WORKSPACE_ID=$(az monitor log-analytics workspace show --resource-group $RESOURCE_GROUP --workspace-name $LOG_WS --query id --output tsv)
   az containerapp env create `
     --name $ACA_ENV `
     --resource-group $RESOURCE_GROUP `
     --location $LOCATION `
     --logs-workspace-id $WORKSPACE_ID
   ```
6. Create the Static Web App placeholder (deployment will happen later via GitHub Actions):
   ```powershell
   az staticwebapp create `
     --name $SWA_NAME `
     --resource-group $RESOURCE_GROUP `
     --source https://github.com/<your-account>/Adaptive-Stock-Trading `
     --branch main `
     --location $LOCATION `
     --app-location "apps/client" `
     --output-location "dist" `
     --login-with-azure `
     --sku Free
   ```
   > Replace `<your-account>` with your GitHub user/organization. The command provisions SWA and sets up a GitHub Actions workflow file in your fork (you can edit it before merging).

## 3. Build and push the backend container

1. Log in to ACR and build the image locally:
   ```powershell
   az acr login --name $ACR_NAME
   docker build `
     --file backend/Dockerfile `
     --tag $ACR_NAME.azurecr.io/stocktrade-api:latest `
     .
   ```
2. Push the image to ACR:
   ```powershell
   docker push $ACR_NAME.azurecr.io/stocktrade-api:latest
   ```

## 4. Configure secrets and managed identity

1. Assign a system-assigned managed identity to the future Container App and grant it access to Key Vault later. For now, create the app (without an image deployed yet):
   ```powershell
   az containerapp create `
     --name $ACA_APP `
     --resource-group $RESOURCE_GROUP `
     --environment $ACA_ENV `
     --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest `
     --target-port 8080 `
     --ingress 'external' `
     --query "properties.configuration.ingress.fqdn" `
     --min-replicas 1
   ```
2. Capture the managed identity principal ID:
   ```powershell
   $IDENTITY_ID=$(az containerapp show --name $ACA_APP --resource-group $RESOURCE_GROUP --query "identity.principalId" --output tsv)
   ```
3. Grant Key Vault secrets get/list permissions to the identity:
   ```powershell
   az keyvault set-policy `
     --name $KV_NAME `
     --object-id $IDENTITY_ID `
     --secret-permissions get list
   ```
4. Store your backend secrets in Key Vault (example using Polygon API key):
   ```powershell
   az keyvault secret set `
     --vault-name $KV_NAME `
     --name "PolygonApiKey" `
     --value "<your-real-api-key>"
   ```

## 5. Deploy the backend container to Container Apps

1. Create a Container Apps secret that references the Key Vault secret:
   ```powershell
   az containerapp secret set `
     --name $ACA_APP `
     --resource-group $RESOURCE_GROUP `
     --secrets polygon-key=secretref://$KV_NAME/PolygonApiKey
   ```
2. Configure environment variables, scaling, and image reference:
   ```powershell
   az containerapp update `
     --name $ACA_APP `
     --resource-group $RESOURCE_GROUP `
     --image $ACR_NAME.azurecr.io/stocktrade-api:latest `
     --target-port 8080 `
     --ingress external `
     --min-replicas 1 `
     --max-replicas 5 `
     --scale-rule-name http-scaling `
     --scale-rule-type http `
     --scale-rule-http-concurrency 50 `
     --environment-variables "POLYGON_API_KEY=secretref:polygon-key" "ENVIRONMENT=production" `
     --registry-identity system `
     --registry-server $ACR_NAME.azurecr.io
   ```
   > Adjust environment variables to match entries in `backend/packages/shared/config.py`.

## 6. Wire Static Web Apps to the backend API

1. Grab the backend FQDN:
   ```powershell
   $API_FQDN = az containerapp show --name $ACA_APP --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" --output tsv
   ```
2. Update the SWA `routes.json` file (in `apps/client`) to proxy API routes and websockets:
   ```jsonc
   {
     "routes": [
       {
         "route": "/api/*",
         "allowedRoles": ["anonymous"],
         "rewrite": "https://$API_FQDN/api"
       },
       {
         "route": "/ws/*",
         "allowedRoles": ["anonymous"],
         "rewrite": "wss://$API_FQDN/ws"
       }
     ]
   }
   ```
   Commit and push the change so the SWA GitHub Action picks it up during deployment.
3. In the SWA portal, set frontend build-time variables (under **Configuration** > **Application settings**) if you have environment-specific values, e.g. `VITE_API_BASE_URL=/api`.

## 7. Build and deploy the frontend (CI/CD)

1. The `az staticwebapp create` command places a GitHub Actions workflow file inside `.github/workflows/azure-static-web-apps-*.yml`. Review and adjust the build steps:
   ```yaml
   app_location: "apps/client"
   api_location: ""
   output_location: "dist"
   ```
2. Check in any required environment variables as SWA secrets (GitHub repo settings > Secrets and variables > Actions). For example, `SWA_API_TOKEN` is created automatically; keep it safe.
3. Commit changes and push to `main`. The GitHub Action will build the client and upload the `dist` folder to SWA.

## 8. Verification checklist

- Hit the SWA URL in a browser; confirm the UI loads and API calls succeed.
- Use `wscat` or the app UI to verify the websocket stream connects (SWA proxy must allow it).
- Check ACA diagnostics: `az containerapp logs show --name $ACA_APP --resource-group $RESOURCE_GROUP --tail 100`.
- Review Log Analytics queries for container metrics; optionally link Application Insights for more granularity (`az monitor app-insights component create ...`).
- Run end-to-end smoke tests (existing test suite or `perf/k6-smoke.js`) against the public endpoints.

## 9. Ongoing maintenance tips

- Enable autoscaling rules beyond HTTP if you need CPU/memory triggers (`az containerapp revision set-mode single` and `az containerapp update --scale-rule-type custom`).
- Rotate secrets by updating Key Vault entries; ACA picks up new versions without redeploying images.
- Use deployment slots in SWA for staging branches to preview changes before affecting production users.
- Tag resources in Azure (`--tags env=production app=stocktrade`) to aid cost tracking and governance.
- Monitor cost using Cost Management + Billing; both SWA Free tier and ACA with minimal replicas stay low-cost for development.

With these steps you have a reproducible Azure deployment path. If you need automation, consider wrapping the CLI commands in Bicep or Terraform and attaching them to CI/CD pipelines.
