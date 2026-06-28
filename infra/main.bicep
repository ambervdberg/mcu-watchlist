targetScope = 'resourceGroup'

@minLength(1)
param environmentName string

@minLength(1)
param location string = resourceGroup().location

@secure()
param sessionSecret string

@secure()
param resendApiKey string

@secure()
param statsApiKey string

param tableName string = 'WatchProgress'
param usersTableName string = 'Users'
param loginTokensTableName string = 'LoginTokens'
param emailFrom string = 'Marvel Watchlist <no-reply@codequest.nl>'

// The Static Web App's custom domain is attached outside this Bicep file (Azure Portal / DNS),
// so it isn't derivable from any resource here. Set it via `azd env set APP_BASE_URL <url>`;
// otherwise this falls back to the auto-generated *.azurestaticapps.net hostname.
param appBaseUrl string = ''

var resourceToken = toLower(uniqueString(resourceGroup().id, environmentName, location))
var staticWebAppName = 'stapp-marvel-${resourceToken}'
var storageAccountName = 'stmarvel${resourceToken}'
var logAnalyticsWorkspaceName = 'log-marvel-${resourceToken}'
var appInsightsName = 'appi-marvel-${resourceToken}'
var tags = {
  'azd-env-name': environmentName
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource progressTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: tableName
}

resource usersTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: usersTableName
}

resource loginTokensTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: loginTokensTableName
}

var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

// Server-side only: no client script is added to the frontend, so the Functions
// host reports request/dependency/trace telemetry to Application Insights without
// setting any cookie or collecting visitor identity. See CLAUDE.md "Monitoring".
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
    DisableIpMasking: false
  }
}

resource staticWebApp 'Microsoft.Web/staticSites@2024-11-01' = {
  name: staticWebAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'web'
  })
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    stagingEnvironmentPolicy: 'Disabled'
    allowConfigFileUpdates: true
    publicNetworkAccess: 'Enabled'
  }
}

resource appSettings 'Microsoft.Web/staticSites/config@2024-11-01' = {
  parent: staticWebApp
  name: 'appsettings'
  kind: 'string'
  properties: {
    APP_BASE_URL: empty(appBaseUrl) ? 'https://${staticWebApp.properties.defaultHostname}' : appBaseUrl
    EMAIL_FROM: emailFrom
    RESEND_API_KEY: resendApiKey
    SESSION_SECRET: sessionSecret
    STATS_API_KEY: statsApiKey
    STORAGE_CONNECTION_STRING: storageConnectionString
    TABLE_NAME: tableName
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.properties.ConnectionString
  }
}

output AZURE_STATIC_WEB_APP_NAME string = staticWebApp.name
output AZURE_STATIC_WEB_APP_URL string = 'https://${staticWebApp.properties.defaultHostname}'
output APPLICATIONINSIGHTS_NAME string = appInsights.name
