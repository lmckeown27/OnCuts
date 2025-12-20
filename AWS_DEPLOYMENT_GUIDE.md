# CampusCuts AWS Deployment Guide

Complete guide to deploying CampusCuts on AWS with PostgreSQL, backend, and frontend.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         USERS                                │
│              (Web browsers, Mobile apps)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    AWS CloudFront                            │
│              (CDN for Frontend Assets)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌──────────────────┐            ┌──────────────────┐
│   S3 Bucket      │            │  AWS Amplify     │
│   (Frontend)     │            │  (Alternative)   │
└──────────────────┘            └──────────────────┘
                                         │
                                         ▼
                                ┌──────────────────┐
                                │   API Gateway    │
                                │   (Optional)     │
                                └────────┬─────────┘
                                         │
                                         ▼
                        ┌────────────────────────────┐
                        │    Elastic Load Balancer   │
                        └────────────┬───────────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                │                    │                    │
                ▼                    ▼                    ▼
        ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
        │   EC2        │    │   EC2        │    │   EC2        │
        │   Backend    │    │   Backend    │    │   Backend    │
        │   Instance 1 │    │   Instance 2 │    │   Instance 3 │
        └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
               │                   │                    │
               └───────────────────┼────────────────────┘
                                   │
                                   ▼
                        ┌──────────────────┐
                        │   RDS Postgres   │
                        │   (Database)     │
                        └──────────────────┘
                                   │
                                   ▼
                        ┌──────────────────┐
                        │   ElastiCache    │
                        │   (Redis)        │
                        └──────────────────┘
```

---

## Part 1: PostgreSQL on AWS RDS

### Step 1: Create RDS PostgreSQL Instance

#### Via AWS Console

1. **Navigate to RDS**
   - Open AWS Console
   - Go to Services → Database → RDS
   - Click "Create database"

2. **Database Creation Method**
   - Select: **Standard create**

3. **Engine Options**
   - Engine type: **PostgreSQL**
   - Version: **PostgreSQL 15.x** (latest stable)

4. **Templates**
   - For production: **Production**
   - For testing: **Dev/Test**

5. **Settings**
   ```
   DB instance identifier: campuscuts-prod-db
   Master username: campuscuts_admin
   Master password: [Generate secure password]
   ✓ Auto generate password (recommended)
   ```

6. **Instance Configuration**
   - **For Production:**
     - DB instance class: `db.t3.medium` (2 vCPU, 4 GB RAM)
     - Or: `db.t3.large` (2 vCPU, 8 GB RAM) for high traffic
   
   - **For Staging:**
     - DB instance class: `db.t3.micro` (2 vCPU, 1 GB RAM)

7. **Storage**
   ```
   Storage type: General Purpose SSD (gp3)
   Allocated storage: 20 GB (starting point)
   Storage autoscaling: ✓ Enable
   Maximum storage threshold: 100 GB
   ```

8. **Availability & Durability**
   - **Production:**
     - ✓ Create standby instance (Multi-AZ)
   - **Staging:**
     - ✗ Single-AZ (cost savings)

9. **Connectivity**
   ```
   Virtual private cloud (VPC): [Select your VPC]
   Subnet group: [Select subnet group]
   Public access: No (security best practice)
   VPC security group: Create new
   Security group name: campuscuts-db-sg
   ```

10. **Database Authentication**
    - ✓ Password authentication
    - ✓ IAM database authentication (optional, for extra security)

11. **Additional Configuration**
    ```
    Initial database name: campuscuts
    DB parameter group: default.postgres15
    Backup retention period: 7 days (production)
    ✓ Enable automated backups
    Backup window: 03:00-04:00 UTC
    ✓ Enable encryption
    Encryption key: (default) aws/rds
    ✓ Enable Enhanced monitoring
    Monitoring role: rds-monitoring-role
    ✓ Enable auto minor version upgrade
    Maintenance window: Sun 04:00-05:00 UTC
    ```

12. **Click "Create database"**
    - Wait 5-10 minutes for provisioning
    - Note the endpoint URL (you'll need this)

#### Via AWS CLI

```bash
# Set variables
DB_INSTANCE_ID="campuscuts-prod-db"
DB_NAME="campuscuts"
DB_USERNAME="campuscuts_admin"
DB_PASSWORD="your-secure-password-here"  # Use strong password!
VPC_SECURITY_GROUP_ID="sg-xxxxxxxxxxxxx"  # Your security group ID
DB_SUBNET_GROUP="default"  # Or your custom subnet group

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier $DB_INSTANCE_ID \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.3 \
  --master-username $DB_USERNAME \
  --master-user-password $DB_PASSWORD \
  --allocated-storage 20 \
  --storage-type gp3 \
  --storage-encrypted \
  --vpc-security-group-ids $VPC_SECURITY_GROUP_ID \
  --db-subnet-group-name $DB_SUBNET_GROUP \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00" \
  --multi-az \
  --publicly-accessible false \
  --db-name $DB_NAME \
  --enable-iam-database-authentication \
  --monitoring-interval 60 \
  --enable-cloudwatch-logs-exports '["postgresql","upgrade"]' \
  --tags Key=Project,Value=CampusCuts Key=Environment,Value=Production

# Wait for database to be available
aws rds wait db-instance-available --db-instance-identifier $DB_INSTANCE_ID

# Get database endpoint
aws rds describe-db-instances \
  --db-instance-identifier $DB_INSTANCE_ID \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

### Step 2: Configure Security Groups

```bash
# Get your database security group ID
DB_SECURITY_GROUP=$(aws rds describe-db-instances \
  --db-instance-identifier campuscuts-prod-db \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text)

# Allow inbound PostgreSQL traffic from backend instances
aws ec2 authorize-security-group-ingress \
  --group-id $DB_SECURITY_GROUP \
  --protocol tcp \
  --port 5432 \
  --source-group $BACKEND_SECURITY_GROUP_ID \
  --description "Allow backend instances to connect to PostgreSQL"

# For development/migration (temporary):
# Allow your IP to connect for migrations
YOUR_IP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress \
  --group-id $DB_SECURITY_GROUP \
  --protocol tcp \
  --port 5432 \
  --cidr ${YOUR_IP}/32 \
  --description "Temporary: Allow migrations from dev machine"

# IMPORTANT: Remove this rule after migrations are complete!
```

### Step 3: Connect and Initialize Database

```bash
# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier campuscuts-prod-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

# Set DATABASE_URL
export DATABASE_URL="postgresql://campuscuts_admin:your-password@${RDS_ENDPOINT}:5432/campuscuts?sslmode=require"

# Test connection
psql $DATABASE_URL -c "SELECT version();"

# Run Prisma migrations
cd backend
npx prisma migrate deploy

# (Optional) Generate Prisma client
npx prisma generate

# (Optional) Seed database
npm run seed
```

### Step 4: Configure Connection Pooling

For production, use RDS Proxy for connection pooling:

```bash
# Create RDS Proxy
aws rds create-db-proxy \
  --db-proxy-name campuscuts-proxy \
  --engine-family POSTGRESQL \
  --auth '[
    {
      "AuthScheme": "SECRETS",
      "SecretArn": "arn:aws:secretsmanager:region:account:secret:rds-db-credentials",
      "IAMAuth": "DISABLED"
    }
  ]' \
  --role-arn arn:aws:iam::account:role/RDSProxyRole \
  --vpc-subnet-ids subnet-xxxxx subnet-yyyyy \
  --require-tls \
  --tags Key=Project,Value=CampusCuts

# Use proxy endpoint in your application
# DATABASE_URL=postgresql://user:pass@proxy-endpoint:5432/campuscuts
```

---

## Part 2: Backend on AWS EC2/ECS

### Option A: EC2 with Auto Scaling (Recommended)

#### Step 1: Create EC2 Launch Template

```bash
# Create key pair for SSH access
aws ec2 create-key-pair \
  --key-name campuscuts-backend-key \
  --query 'KeyMaterial' \
  --output text > campuscuts-backend-key.pem

chmod 400 campuscuts-backend-key.pem

# Create launch template
aws ec2 create-launch-template \
  --launch-template-name campuscuts-backend-template \
  --version-description "CampusCuts backend v1.0" \
  --launch-template-data '{
    "ImageId": "ami-0c55b159cbfafe1f0",
    "InstanceType": "t3.medium",
    "KeyName": "campuscuts-backend-key",
    "IamInstanceProfile": {
      "Name": "campuscuts-backend-role"
    },
    "SecurityGroupIds": ["sg-xxxxxxxxxxxxx"],
    "UserData": "'"$(base64 -w 0 << 'EOF'
#!/bin/bash
# Update system
apt-get update && apt-get upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Create app directory
mkdir -p /opt/campuscuts
cd /opt/campuscuts

# Clone repository (or use CodeDeploy)
# git clone https://github.com/your-org/campuscuts.git .

# Install dependencies
cd backend
npm ci --production

# Build TypeScript
npm run build

# Set up environment
cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=3001
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}
APTOS_NETWORK=mainnet
APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com/v1
APTOS_PLATFORM_PRIVATE_KEY=${APTOS_PRIVATE_KEY}
APTOS_PLATFORM_ADDRESS=${APTOS_ADDRESS}
APTOS_MODULE_ADDRESS=${MODULE_ADDRESS}
JWT_SECRET=${JWT_SECRET}
STRIPE_SECRET_KEY=${STRIPE_SECRET}
CIRCLE_API_KEY=${CIRCLE_API_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY}
ENVEOF

# Start with PM2
pm2 start dist/index.js --name campuscuts-backend
pm2 startup systemd
pm2 save

# Configure log rotation
pm2 install pm2-logrotate

# Health check endpoint test
sleep 10
curl http://localhost:3001/api/health || exit 1
EOF
)"'
  }'
```

#### Step 2: Create Auto Scaling Group

```bash
# Create target group for load balancer
aws elbv2 create-target-group \
  --name campuscuts-backend-tg \
  --protocol HTTP \
  --port 3001 \
  --vpc-id vpc-xxxxxxxxxxxxx \
  --health-check-enabled \
  --health-check-protocol HTTP \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --target-type instance

# Create Auto Scaling Group
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name campuscuts-backend-asg \
  --launch-template LaunchTemplateName=campuscuts-backend-template,Version='$Latest' \
  --min-size 2 \
  --max-size 10 \
  --desired-capacity 3 \
  --default-cooldown 300 \
  --health-check-type ELB \
  --health-check-grace-period 300 \
  --vpc-zone-identifier "subnet-xxxxx,subnet-yyyyy,subnet-zzzzz" \
  --target-group-arns arn:aws:elasticloadbalancing:region:account:targetgroup/campuscuts-backend-tg/xxxxxxxx \
  --tags Key=Project,Value=CampusCuts Key=Environment,Value=Production

# Create scaling policies
# Scale up when CPU > 70%
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name campuscuts-backend-asg \
  --policy-name scale-up \
  --scaling-adjustment 1 \
  --adjustment-type ChangeInCapacity \
  --cooldown 300

# Scale down when CPU < 30%
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name campuscuts-backend-asg \
  --policy-name scale-down \
  --scaling-adjustment -1 \
  --adjustment-type ChangeInCapacity \
  --cooldown 300
```

#### Step 3: Create Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name campuscuts-alb \
  --subnets subnet-xxxxx subnet-yyyyy subnet-zzzzz \
  --security-groups sg-xxxxxxxxxxxxx \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --tags Key=Project,Value=CampusCuts

# Create HTTPS listener (requires SSL certificate)
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:region:account:loadbalancer/app/campuscuts-alb/xxxxxxxx \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:region:account:certificate/xxxxxxxx \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:region:account:targetgroup/campuscuts-backend-tg/xxxxxxxx

# Create HTTP listener (redirect to HTTPS)
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:region:account:loadbalancer/app/campuscuts-alb/xxxxxxxx \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'
```

### Option B: ECS Fargate (Serverless)

```bash
# Create ECS cluster
aws ecs create-cluster \
  --cluster-name campuscuts-cluster \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1,base=1

# Create task definition
cat > task-definition.json << 'EOF'
{
  "family": "campuscuts-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/campuscuts-backend-role",
  "containerDefinitions": [
    {
      "name": "campuscuts-backend",
      "image": "account.dkr.ecr.region.amazonaws.com/campuscuts-backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3001"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:region:account:secret:campuscuts/database-url"},
        {"name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:region:account:secret:campuscuts/jwt-secret"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/campuscuts-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3001/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create ECS service
aws ecs create-service \
  --cluster campuscuts-cluster \
  --service-name campuscuts-backend-service \
  --task-definition campuscuts-backend \
  --desired-count 3 \
  --launch-type FARGATE \
  --platform-version LATEST \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx,subnet-yyyyy],securityGroups=[sg-xxxxxxxxxxxxx],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:region:account:targetgroup/campuscuts-backend-tg/xxxxxxxx,containerName=campuscuts-backend,containerPort=3001" \
  --health-check-grace-period-seconds 60 \
  --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100,deploymentCircuitBreaker={enable=true,rollback=true}"
```

---

## Part 3: ElastiCache Redis

```bash
# Create Redis subnet group
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name campuscuts-redis-subnet \
  --cache-subnet-group-description "Subnet group for CampusCuts Redis" \
  --subnet-ids subnet-xxxxx subnet-yyyyy

# Create Redis cluster
aws elasticache create-replication-group \
  --replication-group-id campuscuts-redis \
  --replication-group-description "CampusCuts Redis Cluster" \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-clusters 2 \
  --automatic-failover-enabled \
  --multi-az-enabled \
  --cache-subnet-group-name campuscuts-redis-subnet \
  --security-group-ids sg-xxxxxxxxxxxxx \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token "your-redis-password-here" \
  --snapshot-retention-limit 5 \
  --snapshot-window "03:00-05:00" \
  --preferred-maintenance-window "sun:05:00-sun:07:00"

# Get Redis endpoint
aws elasticache describe-replication-groups \
  --replication-group-id campuscuts-redis \
  --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' \
  --output text
```

---

## Part 4: Frontend Deployment

### Option A: S3 + CloudFront (Recommended)

```bash
# Create S3 bucket
aws s3 mb s3://campuscuts-frontend-prod

# Enable static website hosting
aws s3 website s3://campuscuts-frontend-prod \
  --index-document index.html \
  --error-document index.html

# Build frontend
cd web-app
npm run build

# Upload to S3
aws s3 sync dist/ s3://campuscuts-frontend-prod/ \
  --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "index.html"

# Upload index.html without caching
aws s3 cp dist/index.html s3://campuscuts-frontend-prod/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

# Create CloudFront distribution
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json

# cloudfront-config.json
cat > cloudfront-config.json << 'EOF'
{
  "CallerReference": "campuscuts-$(date +%s)",
  "Comment": "CampusCuts Frontend Distribution",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-campuscuts-frontend",
        "DomainName": "campuscuts-frontend-prod.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-campuscuts-frontend",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    },
    "Compress": true,
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000
  },
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  },
  "Enabled": true
}
EOF
```

### Option B: AWS Amplify

```bash
# Initialize Amplify app
aws amplify create-app \
  --name campuscuts-frontend \
  --repository https://github.com/your-org/campuscuts \
  --oauth-token $GITHUB_TOKEN

# Create branch
aws amplify create-branch \
  --app-id $APP_ID \
  --branch-name main \
  --enable-auto-build

# Configure build settings
aws amplify update-app \
  --app-id $APP_ID \
  --build-spec '{
    "version": 1,
    "frontend": {
      "phases": {
        "preBuild": {
          "commands": [
            "cd web-app",
            "npm ci"
          ]
        },
        "build": {
          "commands": [
            "npm run build"
          ]
        }
      },
      "artifacts": {
        "baseDirectory": "dist",
        "files": [
          "**/*"
        ]
      },
      "cache": {
        "paths": [
          "node_modules/**/*"
        ]
      }
    }
  }'
```

---

## Part 5: Environment Variables & Secrets

### Using AWS Secrets Manager

```bash
# Store database URL
aws secretsmanager create-secret \
  --name campuscuts/database-url \
  --description "PostgreSQL connection string" \
  --secret-string "postgresql://user:pass@rds-endpoint:5432/campuscuts"

# Store JWT secret
aws secretsmanager create-secret \
  --name campuscuts/jwt-secret \
  --secret-string "$(openssl rand -base64 32)"

# Store Stripe key
aws secretsmanager create-secret \
  --name campuscuts/stripe-secret \
  --secret-string "sk_live_xxxxxxxxxxxxx"

# Store Aptos private key
aws secretsmanager create-secret \
  --name campuscuts/aptos-private-key \
  --secret-string "0x..."

# Retrieve secrets in application
aws secretsmanager get-secret-value \
  --secret-id campuscuts/database-url \
  --query SecretString \
  --output text
```

---

## Part 6: Monitoring & Logging

### CloudWatch Setup

```bash
# Create log groups
aws logs create-log-group --log-group-name /aws/ec2/campuscuts-backend
aws logs create-log-group --log-group-name /aws/rds/postgresql/campuscuts

# Set retention
aws logs put-retention-policy \
  --log-group-name /aws/ec2/campuscuts-backend \
  --retention-in-days 30

# Create CloudWatch dashboard
aws cloudwatch put-dashboard \
  --dashboard-name CampusCuts \
  --dashboard-body file://dashboard.json
```

### Alarms

```bash
# High CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name campuscuts-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:region:account:topic/campuscuts-alerts

# Database connections alarm
aws cloudwatch put-metric-alarm \
  --alarm-name campuscuts-db-connections \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:region:account:topic/campuscuts-alerts
```

---

## Part 7: SSL/TLS Certificates

```bash
# Request certificate
aws acm request-certificate \
  --domain-name campuscuts.com \
  --subject-alternative-names *.campuscuts.com \
  --validation-method DNS

# Validate via Route53 (if using)
# Follow instructions in ACM console to add DNS records
```

---

## Part 8: CI/CD Pipeline

### Using AWS CodePipeline

```bash
# Create CodePipeline
aws codepipeline create-pipeline --cli-input-json file://pipeline.json
```

---

## Cost Estimates

### Production Setup (Monthly)
- RDS db.t3.medium Multi-AZ: **$120**
- EC2 t3.medium x3 instances: **$75**
- ALB: **$20**
- ElastiCache t3.micro: **$15**
- S3 + CloudFront: **$10**
- Data transfer: **$20**
- **Total: ~$260/month**

### Staging Setup (Monthly)
- RDS db.t3.micro: **$15**
- EC2 t3.micro x1: **$8**
- ElastiCache t3.micro: **$15**
- S3: **$5**
- **Total: ~$43/month**

---

## Quick Start Script

```bash
#!/bin/bash
# Complete AWS deployment script

# Set your variables
export AWS_REGION="us-east-1"
export PROJECT_NAME="campuscuts"
export ENVIRONMENT="production"

# 1. Create RDS
./scripts/aws-deploy-rds.sh

# 2. Deploy backend
./scripts/aws-deploy-backend.sh

# 3. Deploy frontend
./scripts/aws-deploy-frontend.sh

# 4. Configure monitoring
./scripts/aws-setup-monitoring.sh

echo "✅ Deployment complete!"
echo "Backend URL: https://api.campuscuts.com"
echo "Frontend URL: https://campuscuts.com"
```

---

## Troubleshooting

### Database Connection Issues
```bash
# Test from EC2 instance
psql $DATABASE_URL -c "SELECT 1;"

# Check security groups
aws ec2 describe-security-groups --group-ids sg-xxxxx

# Check RDS status
aws rds describe-db-instances --db-instance-identifier campuscuts-prod-db
```

### Backend Not Starting
```bash
# SSH into EC2
ssh -i campuscuts-backend-key.pem ubuntu@ec2-instance

# Check logs
pm2 logs campuscuts-backend

# Check env vars
pm2 env 0
```

---

## Security Checklist

- [ ] RDS encryption at rest enabled
- [ ] RDS in private subnet (no public access)
- [ ] Redis encryption in transit enabled
- [ ] SSL/TLS certificate configured
- [ ] Security groups properly configured
- [ ] IAM roles follow least privilege
- [ ] Secrets stored in Secrets Manager
- [ ] CloudWatch logging enabled
- [ ] Automated backups configured
- [ ] Multi-AZ for production databases

---

**Your CampusCuts platform is now deployed on AWS!** 🚀

