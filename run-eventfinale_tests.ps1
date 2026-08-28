param ([switch]$useLocal = $false,
    [switch]$create = $false,
    [switch]$addScore = $false,
    [switch]$daily = $false
)


$local_host = "http://localhost:5001/zpln-3be94/us-central1/"
$remote_host = "https://us-central1-zpln-3be94.cloudfunctions.net/" #CreateBrandEvent"
$host_url = $remote_host
if ($useLocal) {
    $host_url = $local_host
}

if ($create)
{
    Write-Output "Creating Tournaments in $( $host_url )"
    $events = @()
    $response = Invoke-RestMethod "$( $host_url )CreateDailyEvent"
    Write-Output "Daily Event: $response"
    $events += ,$response.eventId;
    $response = Invoke-RestMethod "$( $host_url )CreateZplnEvents"
    Write-Output "Zpln Event: $( $response )"
    foreach ($item in $response)
    {
        Write-Output "Adding $( $item.eventId )."
        $events += ,$item.eventId
    }

    $response = Invoke-RestMethod "$( $host_url )CreateBrandEvent"
    Write-Output "Brand Event: $response"
    $events += ,$response;

    $response = Invoke-RestMethod "$( $host_url )CreateJackpotEvent"
}

if ($addScore)
{
    Write-Output "Add Scores $( $events )"
    $users = "c6txFMR4VrTa4Bi81sdyPOo1ZFE2", "am0kTYbt32QOBcSkIkvmyra6Sco2", "Hz387fWV4wbWvM6lzldSOAoRUzu1"
    foreach ($user in $users)
    {
        foreach ($event in $events)
        {
            Write-Output "$( $event ) - $( $user )"
            Invoke-RestMethod "$( $host_url )JoinTournament?eventId=$( $event )&userId=$( $user )"
            Invoke-RestMethod "$( $host_url )AddScoreToTournament?eventId=$( $event )&userId=$( $user )&highScore=$( Get-Random -Minimum 1200 -Maximum 30000 )&credits=$( Get-Random -Minimum 1 -Maximum 100 )"
        }

    }
}

if ($daily)
{
    Write-Output "Pass one Day"
    Invoke-RestMethod "$( $host_url )DailyRecapManual"
}




