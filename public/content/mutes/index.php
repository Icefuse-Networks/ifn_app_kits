<?php

include '__config.php';
$mysqli=__connect_to_MySQL();

$bad=False;
$bad2=False;
$good=False;

if( isset($_POST['lookup_text']) )
{
	$__val=trim($_POST['lookup_text']);
	if (preg_match('/^[A-Za-z0-9 _-]+$/',$__val) == 1)
	{
		$__val=$mysqli->real_escape_string($__val);
		$arr = $mysqli->query("SELECT id,name,`start`,`end` FROM mutes where (name LIKE CONCAT('%', '".$__val."' ,'%') or id LIKE CONCAT('%', '".$__val."' ,'%') ) ORDER BY `id` DESC LIMIT 750");
		$good=True;
		if ($arr->num_rows == 0)
		{
			$arr = $mysqli->query("SELECT id,name,`start`,`end` FROM mutes ORDER BY `id` DESC LIMIT 750");
			$bad2=True;
			$good=False;
		}
	}
	else
	{
		$bad=True;
		$arr = $mysqli->query("SELECT id,name,`start`,`end` FROM mutes ORDER BY `id` DESC LIMIT 750");
	}
}
else
{
	$arr = $mysqli->query("SELECT id,name,`start`,`end` FROM mutes ORDER BY `id` DESC LIMIT 750");	
}
?>

<html dir="ltr" lang="en-US">
	<head>
		<title>Icefuse Networks Rust Mutes</title>
		<meta charset="utf-8" />
		<meta name="author" content="Icefuse CEO">
		<link rel="icon" href="favicon.ico" type="image/x-icon"/>
	    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
		<link href="https://icefuse.com/assets/css/bootstrap.min.css" rel="stylesheet">
	</head>
	<style>
	@font-face {
	  font-family: OpenSansSemiBold;
	  src: url(ttf/OpenSans-Semibold.ttf);
	}

	.info_bg {background-color: #202427;}

	.info_bg2 {background-color: #1d2023;} 

    .table_md td {padding: .6rem;vertical-align: middle}

    .table-dark.table-striped2 tbody tr:nth-of-type(odd) {background-color: rgba(255,255,255,.02)}

    .table_darker_border td, .table_darker_border th, .table_darker_border thead th { border-color: #2a2f33 }

	.ifn_header_link {
		color:white;
		font-size:18px;
		font-family:OpenSansSemiBold;
	}

	.ifn_header_link:hover, .ifn_header_link:active, .ifn_header_link:focus {
		color:#eaeaea;
	}

	.panel_main {
		margin-top:65px;
		margin-bottom:25px;
		border: 1px solid transparent;
	}
	</style>

	<body class="d-flex flex-column bg-secondary">

		<nav class="navbar navbar-expand-xl navbar-dark bg-primary py-3">
			<a class="ifn_header_link" href="">Icefuse Networks Rust Mutes</a>
		</nav>

		<div class="container mt-4 info_bg2">
			<div class="card nodisplay info_bg2">
			  	<div class="card-body">
				<?php
				if ($bad == True)
				{
				?>
				<div class="alert alert-danger" role="alert">
  					Something that you entered was incorrect. Please try again...
				</div>
				<?php
				}
				if ($bad2 == True)
				{
				?>
				<div class="alert alert-info" role="alert">
  					We were unable to find any entries with what you entered. Please try again...
				</div>
				<?php
				}
				if ($good == True)
				{
				?>
				<div class="alert alert-success" role="alert">
  					Your requested search result is below...
				</div>
				<?php
				}
				?>
				<form method="post">
					<div class="input-group">
					  <input type="text" name="lookup_text" class="form-control" placeholder="Search For Name, SteamID or Issuer...">
					</div>
				</form>
				<table class="table table-responsive-sm table-dark table_darker_border bg-subimage table-striped2 mb-0 dataTable info_bg no-footer" style="margin-bottom: 0;">
					<thead>
						<tr>
					    	<th scope="col">Name</th>
					    	<th scope="col">SteamID</th>
					    	<th scope="col">Expires</th>
					    </tr>
					</thead>
					<tbody class="table_md">
					<?php
						foreach ($arr as $key) 
						{
						    echo "<tr>".PHP_EOL;
						    echo "<td><a class='text-light text_white' target=_blank href='http://steamcommunity.com/profiles/".$key["id"]."'>".($key["name"]!='' ? $key["name"] : '__blank') ."</a></td>";
						    echo "<td><a class='text-light text_white' target=_blank href='http://steamcommunity.com/profiles/".$key["id"]."'>".$key["id"]."</a></td>";
						    $date = gmdate("Y-m-d H:i:s");$datetime1 = new DateTime($date);$int=$datetime1->diff(new DateTime($key["end"]));
						    echo "<td class='text-light text_white'>". $int->h ." Hours ".($int->i>0 ? $int->i." Minutes" : '') ."</a></td>";
						    echo "</tr>".PHP_EOL;
						}
					?>
				  	</tbody>
				</table>
				</div>
			</div>
		</div>

	</body>

</html>