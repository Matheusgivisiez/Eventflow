# AWS edge blueprint

Use this layout for white-label event pages and organizer assets.

- S3 bucket `eventhub-assets-prod` stores logos, banners, email assets and static exports.
- CloudFront distribution terminates custom domains with ACM certificates.
- Route 53 creates organizer CNAMEs to the CloudFront distribution.
- Origin access control blocks public S3 access.
- Lifecycle rules move old logs/backups to Glacier.
- WAF enables rate limits and managed bot/fraud rules.

Recommended runtime services:

- EKS for API, web and workers.
- RDS PostgreSQL with read replicas.
- ElastiCache Redis Cluster for cache, rate limits and seat locks.
- Amazon MQ/RabbitMQ for checkout, email, fraud and sync queues.
- S3 for encrypted backups.
