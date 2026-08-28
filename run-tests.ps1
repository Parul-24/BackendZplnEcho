param ([int]$num_changes=1)


Write-Output "Creating Tournaments"
#Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/CreateNewTournament?eventId=MainEvent&eventName=Main Event&isMainEvent=true&startDate=2020/12/21&numberOfGames=5&numberOfSeries=4&durationOfSerie=72"
#Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/CreateNewTournament?eventId=DailyEvent&eventName=Daily Event&isMainEvent=false&startDate=2020/12/20&numberOfGames=5&numberOfSeries=1&durationOfSerie=24"
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/CreateNewTournament?eventId=BE_Starbucks_Event&eventName=Starbucks&isMainEvent=false&startDate=2021/01/06&numberOfGames=5&numberOfSeries=1&durationOfSerie=24&creditCost=500&creditJackpot=1000&sponsorLogo=gs://zpln-3be94.appspot.com/Images/Events/PreBeta/starbucks-logo64.png"
#Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/CreateNewTournament?eventId=OtherEvent&eventName=Other Main Event&isMainEvent=true&startDate=2020/12/01&numberOfGames=5&numberOfSeries=4&durationOfSerie=72"


#for ($i=0; $i -le $num_changes;$i++){
#    Write-Output "Change Tournament Phase"
#    Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/ChangeTournamentPhase?eventId=MainEvent"
#}

Write-Output "Active Tournaments"
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/GetActiveTournaments"



