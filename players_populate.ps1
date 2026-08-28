param (
    [switch]$useLocal,
    [int]$noPlayers = 100,
    [switch]$create = $false,
    [switch]$addScore = $false,
    [string]$eventId
)

$local_host = "http://localhost:5001/zpln-3be94/us-central1/"
$remote_host = "https://us-central1-zpln-3be94.cloudfunctions.net/" #CreateBrandEvent"
$host_url = $remote_host
if ($useLocal) {
    $host_url = $local_host
}
$basename = "USER_FAKE"
$users = @()

if ($create)
{
    for ($i = 0; $i -lt $noPlayers; $i++) {
        $username = "$($basename)_$($i)"
        Write-Output "Creating fake users"
        $response = Invoke-RestMethod "$( $host_url )addUser?username=$($username)"
        Write-Output "User Created $($username): $response"
        $users +=,$response;

    }
}
else
{
    $users = @("-Mpf1ZN1E_zUmPGnBpId","-Mpf1ZPLL8Rryk0VDYPc","-Mpf1ZRlNpB4fJOKPuOs","-Mpf1ZXI3OKOB4TjlaSP","-Mpf1Z_Sk1T6KK_9h2eo","-Mpf1ZcSMZPojimpCLNu","-Mpf1ZfhAXC91bemrMcL","-Mpf1ZicAQnRq34bD3Hf","-Mpf1ZlXNDRQTmDOzujJ","-Mpf1ZogJUfS0yV_vK2c","-Mpf1ZraIMEiJEvlYxZv","-Mpf1ZuVmwx82xGo8FLX","-Mpf1ZxdoGviAZZ25j6S","-Mpf1_-LuA3kX9IgMG9x","-Mpf1_2B0tfBtMSQerf9","-Mpf1_54ysWOpiaA8T_x","-Mpf1_7lgOydQJGtrrdH","-Mpf1_Ae4f2Z_mJzUBfj","-Mpf1_DFTJUm2WsDUby3","-Mpf1_Fu7dJCe04U4R4M","-Mpf1_IZJz6zAs6Vd4m_","-Mpf1_LDSWxGC7VZ8mIT","-Mpf1_NsOVsBSul5sRbl","-Mpf1_QY4IrLLOn9bgj-","-Mpf1_TBLRA0Cx3N_6hc","-Mpf1_VqXXZMD0mzbuWF","-Mpf1_YWtJ978zkxminp","-Mpf1_aBRSXiGJ1RwcNx","-Mpf1_ctP8QprYRpBEJy","-Mpf1_fZxf3boZ3o3BcN","-Mpf1_iDFpYiUJpJvuq5","-Mpf1_krN8eivyAwvYee","-Mpf1_nXmts59NwD9U_e","-Mpf1_qCGw-VbLCFFMOQ","-Mpf1_ssmBG0rusnJkhQ","-Mpf1_vWXaL_TEuXBebS","-Mpf1_yBrv9wvUmcG0jd","-Mpf1a-ogOhmVxXPbzLX","-Mpf1a2ifPxrLa1H3GRa","-Mpf1a5GpC2q6jPH_2lZ","-Mpf1a80ltowktGUMITM","-Mpf1aAhKrSeJxj0ktNc","-Mpf1aDLGIvdyr-WR0qq","-Mpf1aG1JTHQ30toI5sU","-Mpf1aIwn3qLb1EaAB59","-Mpf1aL_OYNNPcRpRIio","-Mpf1aOFahDC4vJmJsxQ","-Mpf1aR8mhYnHawycUYc","-Mpf1aToWZp4h9LJpOul","-Mpf1aWV_5A8tIAvDMDo","-Mpf1aZ8C7O2uG6g9Ntq","-Mpf1ab2p5Hsrxm3l-ke","-Mpf1adjSqwU5Zda7ipm","-Mpf1agPYCgP-qsD8aGz","-Mpf1amQz1Y54fZeMIIH","-Mpf1ap2bwL8vkcGWfFg","-Mpf1arw_24C0LfejPxh","-Mpf1aucive2vvL-nZyd","-Mpf1axX6_8aMRLYRZgh","-Mpf1b-C_Yb3o9eFuOJP","-Mpf1b1s9yfdaVwLBUMe","-Mpf1b4kZD3bEHrpbiDr","-Mpf1b7ef-Kgc5EmyPuE","-Mpf1bAC2TWIPWkb5kiW","-Mpf1bD99mG7wodJ9F4b","-Mpf1bFom_Z0C5GTUFJl","-Mpf1bIh7O0rORprC1Ji","-Mpf1bLMImDNBdeqp9vZ","-Mpf1bOHMAAQtbV_KzzN","-Mpf1bRC182KoOlOCFcV","-Mpf1bU4pdN9Dd5JV-93","-Mpf1bWjuHqdCybaQlvd","-Mpf1bZOhuQ1AQwJVFHE","-Mpf1bbGkiA9DIZ7jo12","-Mpf1bduXL5sfnZPjyKg","-Mpf1bgaYxbMcba3r3MA","-Mpf1bjVACJiHrifOo3o","-Mpf1bmBwr_oCOL7tu0E","-Mpf1bp5dQj3OTvkpKbd","-Mpf1brkjkTnaPspR-gs","-Mpf1bueMEpRciIScPUB","-Mpf1bxKzi-1dm86SGLW","-Mpf1c-DjsFP4Rzms8o1","-Mpf1c1t4aOthP3UzXIF","-Mpf1c4metelRiFkncb2","-Mpf1c7R3fk2Tq5zY2zF","-Mpf1cDGxwD3k8EZJI-Z","-Mpf1cGBv93SNjHkYKjp","-Mpf1cIp2zs_ub0O6cHT","-Mpf1cLj8Tcuf5UvGN4V","-Mpf1cOOSFwLUzwBVR5t","-Mpf1cR02EYAE6qE4DnT","-Mpf1cTmbeWZgdU5B7PE","-Mpf1cWc81dmbNhzSuR_","-Mpf1cZHHAnKDFQ82KSP","-Mpf1caxGY_EmEWJY_Zj","-Mpf1cdq0tbQx0PT97KB","-Mpf1cgWs6yEu39eZF95","-Mpf1cjdsQHYCk4NKi10","-Mpf1cmHEfUmQARpY4Vo")
}
Write-Output $users;

if ($addScore -and ($eventId -ne $null) )
{
    Write-Output "Add Scores $( $users ) : $($eventId)"
    foreach ($user in $users)
    {

            Write-Output "$( $eventId ) - $( $user )";
            Invoke-RestMethod "$( $host_url )JoinTournament?eventId=$( $eventId )&userId=$( $user )";
            for ($i = 0; $i -lt 3; $i++) {
                Invoke-RestMethod "$( $host_url )AddScoreToTournament?eventId=$( $eventId )&userId=$( $user )&highScore=$( Get-Random -Minimum 1200 -Maximum 30000 )&credits=$( Get-Random -Minimum 1 -Maximum 100 )"
            }


    }
}

###
#-Mpf1ZN1E_zUmPGnBpId -Mpf1ZPLL8Rryk0VDYPc -Mpf1ZRlNpB4fJOKPuOs -Mpf1ZXI3OKOB4TjlaSP -Mpf1Z_Sk1T6KK_9h2eo -Mpf1ZcSMZPojimpCLNu -Mpf1ZfhAXC91bemrMcL -Mpf1ZicAQnRq34bD3Hf -Mpf1ZlXNDRQTmDOzujJ -Mpf1ZogJUfS0yV_vK2c -Mpf1ZraIMEiJEvlYxZv -Mpf1ZuVmwx82xGo8FLX -Mpf1ZxdoGviAZZ25j6S -Mpf1_-LuA3kX9IgMG9x -Mpf1_2B0tfBtMSQerf9 -Mpf1_54ysWOpiaA8T_x -Mpf1_7lgOydQJGtrrdH -Mpf1_Ae4f2Z_mJzUBfj -Mpf1_DFTJUm2WsDUby3 -Mpf1_Fu7dJCe04U4R4M -Mpf1_IZJz6zAs6Vd4m_ -Mpf1_LDSWxGC7VZ8mIT -Mpf1_NsOVsBSul5sRbl -Mpf1_QY4IrLLOn9bgj- -Mpf1_TBLRA0Cx3N_6hc -Mpf1_VqXXZMD0mzbuWF -Mpf1_YWtJ978zkxminp -Mpf1_aBRSXiGJ1RwcNx -Mpf1_ctP8QprYRpBEJy -Mpf1_fZxf3boZ3o3BcN -Mpf1_iDFpYiUJpJvuq5 -Mpf1_krN8eivyAwvYee -Mpf1_nXmts59NwD9U_e -Mpf1_qCGw-VbLCFFMOQ -Mpf1_ssmBG0rusnJkhQ -Mpf1_vWXaL_TEuXBebS -Mpf1_yBrv9wvUmcG0jd -Mpf1a-ogOhmVxXPbzLX -Mpf1a2ifPxrLa1H3GRa -Mpf1a5GpC2q6jPH_2lZ -Mpf1a80ltowktGUMITM -Mpf1aAhKrSeJxj0ktNc -Mpf1aDLGIvdyr-WR0qq -Mpf1aG1JTHQ30toI5sU -Mpf1aIwn3qLb1EaAB59 -Mpf1aL_OYNNPcRpRIio -Mpf1aOFahDC4vJmJsxQ -Mpf1aR8mhYnHawycUYc -Mpf1aToWZp4h9LJpOul -Mpf1aWV_5A8tIAvDMDo -Mpf1aZ8C7O2uG6g9Ntq -Mpf1ab2p5Hsrxm3l-ke -Mpf1adjSqwU5Zda7ipm -Mpf1agPYCgP-qsD8aGz -Mpf1amQz1Y54fZeMIIH -Mpf1ap2bwL8vkcGWfFg -Mpf1arw_24C0LfejPxh -Mpf1aucive2vvL-nZyd -Mpf1axX6_8aMRLYRZgh -Mpf1b-C_Yb3o9eFuOJP -Mpf1b1s9yfdaVwLBUMe -Mpf1b4kZD3bEHrpbiDr -Mpf1b7ef-Kgc5EmyPuE -Mpf1bAC2TWIPWkb5kiW -Mpf1bD99mG7wodJ9F4b -Mpf1bFom_Z0C5GTUFJl -Mpf1bIh7O0rORprC1Ji -Mpf1bLMImDNBdeqp9vZ -Mpf1bOHMAAQtbV_KzzN -Mpf1bRC182KoOlOCFcV -Mpf1bU4pdN9Dd5JV-93 -Mpf1bWjuHqdCybaQlvd -Mpf1bZOhuQ1AQwJVFHE -Mpf1bbGkiA9DIZ7jo12 -Mpf1bduXL5sfnZPjyKg -Mpf1bgaYxbMcba3r3MA -Mpf1bjVACJiHrifOo3o -Mpf1bmBwr_oCOL7tu0E -Mpf1bp5dQj3OTvkpKbd -Mpf1brkjkTnaPspR-gs -Mpf1bueMEpRciIScPUB -Mpf1bxKzi-1dm86SGLW -Mpf1c-DjsFP4Rzms8o1 -Mpf1c1t4aOthP3UzXIF -Mpf1c4metelRiFkncb2 -Mpf1c7R3fk2Tq5zY2zF -Mpf1cDGxwD3k8EZJI-Z -Mpf1cGBv93SNjHkYKjp -Mpf1cIp2zs_ub0O6cHT -Mpf1cLj8Tcuf5UvGN4V -Mpf1cOOSFwLUzwBVR5t -Mpf1cR02EYAE6qE4DnT -Mpf1cTmbeWZgdU5B7PE -Mpf1cWc81dmbNhzSuR_ -Mpf1cZHHAnKDFQ82KSP -Mpf1caxGY_EmEWJY_Zj -Mpf1cdq0tbQx0PT97KB -Mpf1cgWs6yEu39eZF95 -Mpf1cjdsQHYCk4NKi10 -Mpf1cmHEfUmQARpY4Vo
#>