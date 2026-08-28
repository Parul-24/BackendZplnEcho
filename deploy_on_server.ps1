
Set-Location ./functions
.\node_modules\.bin\tslint --project tsconfig.json
.\node_modules\.bin\tsc
Set-Location ..
firebase deploy --only "functions,pubsub"