<?php
declare(strict_types=1);
namespace SAMS\Repositories;
use SAMS\Helpers\Database;
final class UserRepository{public function findByUsername(string $username):?array{$q=Database::connection()->prepare('SELECT * FROM users WHERE username=? LIMIT 1');$q->execute([$username]);return $q->fetch()?:null;}}
