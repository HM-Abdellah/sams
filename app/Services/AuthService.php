<?php
declare(strict_types=1);
namespace SAMS\Services;
use SAMS\Helpers\Database;
final class AuthService{public function findByUsername(string $username):?array{$q=Database::connection()->prepare('SELECT * FROM users WHERE username=? LIMIT 1');$q->execute([$username]);$u=$q->fetch();return $u?:null;}}
