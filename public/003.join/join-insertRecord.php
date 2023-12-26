<?PHP

 // 변경됨

if(isset($_POST['chk_info'])) {
    $chk_info_value = $_POST['chk_info'];
	
	include("./_connShopDB.php");  // 수정됨

	// 연결 확인
    if (!$conn) {
        die("Connection failed: " . mysqli_connect_error());
    }

    // 데이터베이스에 값을 삽입하는 SQL 쿼리 실행
    $sql = "INSERT INTO memberinfo (height, weight, chk_info_column, unickname) VALUES ('$uheight', '$uweight', '$chk_info_value', '$unickname')";


//echo $sql; 
$result = mysqli_query($con, $sql); // 수정됨
mysqli_close($con);
	
if ($result) {
	
    echo("<script>location.href='submit_progress.html';</script>"); 
} 
else 
{
    echo ("<script>
       		window.alert('회원가입에 실패했습니다. 다시 한 번 시도해 주세요');
      		history.go(-1);
      		</script>
    ");
}
	
//echo   ("<meta http-equiv='Refresh' content='0; url=index.html'>");
echo   ("<meta http-equiv='Refresh' content='0; url=login.html'>");
	
?>

