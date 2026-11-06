-- MySQL dump 10.13  Distrib 8.0.36, for Linux (x86_64)
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40103 SET TIME_ZONE='+00:00' */;

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 DEFAULT NULL COMMENT 'Display name; may be empty',
  `status` enum('active','blocked','pending review') NOT NULL DEFAULT 'active',
  `balance` decimal(12,2) NOT NULL DEFAULT '0.00',
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_status_created_idx` (`status`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registered users';
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `users` WRITE;
INSERT INTO `users` VALUES (1,'a@b.c','O''Neil; x','active',0.00,0,NULL,NULL);
UNLOCK TABLES;

CREATE TABLE `posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `parent_id` int DEFAULT NULL,
  `title` varchar(200) NOT NULL,
  `body` longtext,
  PRIMARY KEY (`id`),
  KEY `posts_user_fk` (`user_id`),
  KEY `posts_parent_fk` (`parent_id`),
  CONSTRAINT `posts_parent_fk` FOREIGN KEY (`parent_id`) REFERENCES `posts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `posts_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `post_tags` (
  `post_id` int NOT NULL,
  `tag` varchar(40) NOT NULL,
  PRIMARY KEY (`post_id`,`tag`),
  CONSTRAINT `pt_post` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`)
) ENGINE=InnoDB;
