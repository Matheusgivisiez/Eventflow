import { Injectable } from "@nestjs/common";

@Injectable()
export class EnterpriseInfrastructureService {
  infrastructureBlueprint() {
    return {
      docker: ["api", "web", "postgres", "redis", "rabbitmq", "prometheus", "grafana", "loki"],
      cicd: "GitHub Actions build, test, docker publish and deploy",
      aws: ["S3 for assets/backups", "CloudFront for white-label domains", "EKS for Kubernetes", "RDS PostgreSQL", "ElastiCache Redis Cluster", "Amazon MQ/RabbitMQ"],
      kubernetes: ["horizontal pod autoscaling", "rolling updates", "secrets", "ingress", "worker deployments"],
      monitoring: ["Prometheus metrics", "Grafana dashboards", "centralized logs", "audit logs", "backup checks"],
      scaling: ["stateless API", "queue-based workers", "read replicas", "tenant-aware indexes", "Redis locks for seat holds"]
    };
  }
}
