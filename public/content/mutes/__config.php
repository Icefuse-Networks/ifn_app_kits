<?php
function __connect_to_MySQL()
{
	/*MySQL CONFIG STUFF*/
	$__dbhost='localhost';
	$__dbuser='ifn_rust';
	$__dbpass='xj13NiGPHndsThPjkvYVEPE2pJe2qat6bJfGxmwjCQ1QDQIubHpza64QZA6FXQzJ';
	$__dbname='ifn_rust';

	$mysql_return = mysqli_connect($__dbhost, $__dbuser, $__dbpass, $__dbname);

	if (!$mysql_return) 
	{
	    echo "Error: ".mysqli_connect_error().PHP_EOL;
	    exit;
	}
	return $mysql_return;
}
?>