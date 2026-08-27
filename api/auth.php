<?php
declare(strict_types=1);
session_start();
require_once __DIR__.'/../app/Helpers/Database.php';
require_once __DIR__.'/../app/Helpers/Auth.php';
require_once __DIR__.'/../app/Helpers/Csrf.php';
require_once __DIR__.'/../app/Helpers/Response.php';
use SAMS\Helpers\Database; use SAMS\Helpers\Auth; use SAMS\Helpers\Csrf; use SAMS\Helpers\Response;
header('Content-Type: application/json; charset=UTF-8');
$action=$_GET['action']??'';
try{
 if($action==='session') Response::success(['authenticated'=>Auth::check(),'user'=>Auth::user(),'csrf'=>Csrf::token()]);
 if($action==='logout'){Auth::logout();Response::success();}
 if($action!=='login') Response::error('Unknown action.',404);
 $body=json_decode((string)file_get_contents('php://input'),true); if(!is_array($body)) $body=$_POST;
 if(!Csrf::verify((string)($body['csrf']??''))) Response::error('Invalid CSRF token.',419);
 $username=trim((string)($body['username']??'')); $password=(string)($body['password']??'');
 if($username===''||$password==='') Response::error('Credentials required.',422);
 $pdo=Database::connection(); $q=$pdo->prepare('SELECT * FROM users WHERE username=? LIMIT 1'); $q->execute([$username]); $u=$q->fetch();
 if(!$u || !(bool)$u['is_active']) Response::error('Invalid credentials.',401);
 if($u['locked_until'] && strtotime((string)$u['locked_until'])>time()) Response::error('Account temporarily locked.',429);
 if(!password_verify($password,(string)$u['password_hash'])){ $f=(int)$u['failed_login_attempts']+1; $lock=$f>=5?date('Y-m-d H:i:s',time()+300):null; $pdo->prepare('UPDATE users SET failed_login_attempts=?,locked_until=? WHERE id=?')->execute([$f,$lock,$u['id']]); Response::error('Invalid credentials.',401); }
 $pdo->prepare('UPDATE users SET failed_login_attempts=0,locked_until=NULL,last_login_at=NOW() WHERE id=?')->execute([$u['id']]);
 Auth::login($u); Response::success(['user'=>Auth::user(),'csrf'=>Csrf::token()]);
}catch(Throwable $e){Response::error('Server error.',500);}
