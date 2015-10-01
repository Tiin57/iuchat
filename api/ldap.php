<?
/*
Error codes:
100: Invalid credentials
101: Object not found
102: Insufficient parameters
*/
error_reporting(E_ERROR | E_PARSE);
if (!isset($_POST["username"]) || !isset($_POST["password"]) || !isset($_POST["hostname"])
	|| !isset($_POST["port"]) || !isset($_POST["ssl"]) || !isset($_POST["baseDN"]) || !isset($_POST["operation"]) || !isset($_POST["rawUsername"])) {
	echo("err102");
	return;
}
extract($_POST);
$baseDN = "ou=Accounts," . $baseDN;
$url = "ldap" . ($ssl == "true" ? "s" : "") . "://" . $hostname . ":" . $port;
$ldap = ldap_connect($url);
ldap_set_option($ldap, LDAP_OPT_REFERRALS, 0);
if ($bind = ldap_bind($ldap, $username, $password)) {
	if ($operation == "authenticate") {
		echo("true");
	} else if ($operation == "getUser") {
		$query = "(name=" . $rawUsername . ")";
		$results = ldap_search($ldap, $baseDN, $query);
		$data = ldap_get_entries($ldap, $results);
		if ($data["count"] == 0) {
			echo("err101 " . ldap_error($ldap));
		} else {
			echo(json_encode($data[0]));
		}
	}
} else {
	echo("err100");
}
?>