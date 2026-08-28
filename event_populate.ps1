
param ([switch]$useLocal = $false)
<#
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/CreateNewTournament?eventId=BE_Starbucks_Event_25&eventName=Starbucks&isMainEvent=false&startDate=09 Oct 2021 00:00:00 GMT&numberOfGames=5&numberOfSeries=1&durationOfSerie=24&creditCost=500&creditJackpot=3000&sponsorLogo=gs://zpln-3be94.appspot.com/Images/Events/PreBeta/starbucks-logo64.png"

Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/AddPrizeToTournament?eventId=BE_Starbucks_Event_25&description=USD100 eGift Card&credits=0&image=gs://zpln-3be94.appspot.com/Images/Events/Beta/Starbucks/starbucks_1.jpg"
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/AddPrizeToTournament?eventId=BE_Starbucks_Event_25&description=USD75 eGift Card&credits=0&image=gs://zpln-3be94.appspot.com/Images/Events/Beta/Starbucks/starbucks_2.jpg"
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/AddPrizeToTournament?eventId=BE_Starbucks_Event_25&description=USD50 eGift Card&credits=0&image=gs://zpln-3be94.appspot.com/Images/Events/Beta/Starbucks/starbucks_3.jpg"
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/AddPrizeToTournament?eventId=BE_Starbucks_Event_25&description=USD25 eGift Card&credits=0&image=gs://zpln-3be94.appspot.com/Images/Events/Beta/Starbucks/starbucks_4.jpg"
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/AddPrizeToTournament?eventId=BE_Starbucks_Event_25&description=USD10 eGift Card&credits=0&image=gs://zpln-3be94.appspot.com/Images/Events/Beta/Starbucks/starbucks_5.jpg"

Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/CreateNewTournament?eventId=BE_Status_Event_25&eventName=Status Design Studio&isMainEvent=false&startDate=08 Oct 2021 00:00:00 GMT&numberOfGames=5&numberOfSeries=1&durationOfSerie=24&creditCost=500&creditJackpot=3000&sponsorLogo=gs://zpln-3be94.appspot.com/Images/Events/PreBeta/starbucks-logo64.png"

Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/AddPrizeToTournament?eventId=BE_Status_Event_25&description=USD25 eGift Card&credits=0&image=gs://zpln-3be94.appspot.com/Images/Events/Beta/Status/status_1.jpg"
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/AddPrizeToTournament?eventId=BE_Status_Event_25&description=USD25 eGift Card&credits=0&image=gs://zpln-3be94.appspot.com/Images/Events/Beta/Status/status_2.jpg"
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/AddPrizeToTournament?eventId=BE_Status_Event_25&description=USD25 eGift Card&credits=0&image=gs://zpln-3be94.appspot.com/Images/Events/Beta/Status/status_3.jpg"
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/AddPrizeToTournament?eventId=BE_Status_Event_25&description=USD25 eGift Card&credits=0&image=gs://zpln-3be94.appspot.com/Images/Events/Beta/Status/status_4.jpg"
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/AddPrizeToTournament?eventId=BE_Status_Event_25&description=USD25 eGift Card&credits=0&image=gs://zpln-3be94.appspot.com/Images/Events/Beta/Status/status_5.jpg"

#
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/CreateNewTournament?eventId=DE_Daily_Gold_Event&eventName=Zpln Daily Event&isMainEvent=false&startDate=08 Oct 2021 00:00:00 GMT&numberOfGames=5&numberOfSeries=1&durationOfSerie=24&creditCost=500&creditJackpot=3000&sponsorLogo=gs://zpln-3be94.appspot.com/Images/Events/PreBeta/starbucks-logo64.png"

Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/AddPrizeToTournament?eventId=BE_Status_Event&description=USD25 Gift eCard&credits=0&image=gs://zpln-3be94.appspot.com/Images/Events/Beta/Status/status_1.jpg"
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/AddPrizeToTournament?eventId=BE_Status_Event&description=USD25 Gift eCard&credits=0&image=gs://zpln-3be94.appspot.com/Images/Events/Beta/Status/status_1.jpg"
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/AddPrizeToTournament?eventId=BE_Status_Event&description=USD25 Gift eCard&credits=0&image=gs://zpln-3be94.appspot.com/Images/Events/Beta/Status/status_3.jpg"
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/AddPrizeToTournament?eventId=BE_Status_Event&description=USD25 Gift eCard&credits=0&image=gs://zpln-3be94.appspot.com/Images/Events/Beta/Status/status_4.jpg"
Invoke-WebRequest "http://localhost:5001/zpln-3be94/us-central1/AddPrizeToTournament?eventId=BE_Status_Event&description=USD25 Gift eCard&credits=0&image=gs://zpln-3be94.appspot.com/Images/Events/Beta/Status/status_5.jpg"
#>

$local_host = "http://localhost:5001/zpln-3be94/us-central1/"
$remote_host = "https://us-central1-zpln-3be94.cloudfunctions.net/" #CreateBrandEvent"
$host_url = $remote_host
if ($useLocal) {
    $host_url = $local_host
}

Invoke-RestMethod "$( $host_url )CreateJackpotEvent"
Invoke-RestMethod "$( $host_url )CreateHighScoreEvent"
Invoke-RestMethod "$( $host_url )CreateAudienceEvent"
#Invoke-RestMethod "$( $host_url )CreateDailyEvent"
#Invoke-RestMethod "$( $host_url )CreateZplnEvents"
#Invoke-RestMethod "$( $host_url )CreateBrandEvent"

$response = Invoke-RestMethod "$( $host_url )CreateBrandEvent?eventName=Amazon&prizePackageId=0";
Invoke-RestMethod "$( $host_url )AddBrandImages?eventId=$($response)&logoImage=gs://zpln-3be94.appspot.com/Images/Events/Brands/amazon/amazon-logo.png&textImage=gs://zpln-3be94.appspot.com/Images/Events/Brands/amazon/amazon-text.png";
Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/amazon/amazon-1.png";
Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/amazon/amazon-2.png";
Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/amazon/amazon-3.png";

$response = Invoke-RestMethod "$( $host_url )CreateBrandEvent?eventName=Cannons&prizePackageId=1";
Invoke-RestMethod "$( $host_url )AddBrandImages?eventId=$($response)&logoImage=gs://zpln-3be94.appspot.com/Images/Events/Brands/cannons/cannons-logo.png&textImage=gs://zpln-3be94.appspot.com/Images/Events/Brands/cannons/cannons-text.png";
Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/cannons/cannons-1.png";
Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/cannons/cannons-2.png";
Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/cannons/cannons-3.png";

$response = Invoke-RestMethod "$( $host_url )CreateBrandEvent?eventName=Ikea&prizePackageId=0";
Invoke-RestMethod "$( $host_url )AddBrandImages?eventId=$($response)&logoImage=gs://zpln-3be94.appspot.com/Images/Events/Brands/ikea/ikea-logo.png&textImage=gs://zpln-3be94.appspot.com/Images/Events/Brands/ikea/ikea-text.png";
Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/ikea/ikea-1.png";
Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/ikea/ikea-2.png";
Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/ikea/ikea-3.png";

$response = Invoke-RestMethod "$( $host_url )CreateBrandEvent?eventName=MoMa&prizePackageId=1";
Invoke-RestMethod "$( $host_url )AddBrandImages?eventId=$($response)&logoImage=gs://zpln-3be94.appspot.com/Images/Events/Brands/moma/moma-logo.png&textImage=gs://zpln-3be94.appspot.com/Images/Events/Brands/moma/moma-text.png";
Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/moma/moma-1.png";
Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/moma/moma-2.png";
Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/moma/moma-3.png";


$response = Invoke-RestMethod "$( $host_url )CreateBrandEvent?eventName=oakley&prizePackageId=1";
Invoke-RestMethod "$( $host_url )AddBrandImages?eventId=$($response)&logoImage=gs://zpln-3be94.appspot.com/Images/Events/Brands/oakley/oakley-logo.png&textImage=gs://zpln-3be94.appspot.com/Images/Events/Brands/oakley/oakley-text.png";
Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/oakley/oakley-1.png";
Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/oakley/oakley-2.png";
Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/oakley/oakley-3.png";

#$response = Invoke-RestMethod "$( $host_url )CreateBrandEvent?eventName=Victoria Secrets&prizePackageId=0";
#Invoke-RestMethod "$( $host_url )AddBrandImages?eventId=$($response)&logoImage=gs://zpln-3be94.appspot.com/Images/Events/Brands/victoria_secrets/vs-logo.png&textImage=gs://zpln-3be94.appspot.com/Images/Events/Brands/vs/vs-text.png";
#Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/victoria_secrets/vs-1.png";
#Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/victoria_secrets/vs-2.png";
#Invoke-RestMethod "$( $host_url )AddCarrouselImage?eventId=$($response)&image=gs://zpln-3be94.appspot.com/Images/Events/Brands/victoria_secrets/vs-3.png";

