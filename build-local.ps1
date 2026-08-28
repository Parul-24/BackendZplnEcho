param (
[switch]$only_emulators = $false,
[switch]$only_functions = $false
)

if (! $only_emulators)
{
    Set-Location functions
    #npm run build
    .\node_modules\.bin\tslint --project tsconfig.json
    .\node_modules\.bin\tsc
    Set-Location ..
}

if ($only_functions){
    firebase emulators:start --only "functions"
} else {
    firebase emulators:start
}