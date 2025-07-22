#!/bin/bash

# 🔄 Rollback Script for DeliveryMiniapp
# This script provides safe rollback capabilities to stable states

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
LOG_DIR="$PROJECT_ROOT/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_DIR/rollback.log"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_DIR/rollback.log"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_DIR/rollback.log"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_DIR/rollback.log"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to create backup
create_backup() {
    local environment=$1
    local backup_name="backup_${environment}_${TIMESTAMP}"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    log "Creating backup for $environment environment..."
    
    mkdir -p "$backup_path"
    
    # Backup database
    if [ -f "$PROJECT_ROOT/$environment/delivery.db" ]; then
        cp "$PROJECT_ROOT/$environment/delivery.db" "$backup_path/"
        log "Database backed up to $backup_path/delivery.db"
    fi
    
    # Backup configuration
    if [ -f "$PROJECT_ROOT/$environment/.env" ]; then
        cp "$PROJECT_ROOT/$environment/.env" "$backup_path/"
        log "Configuration backed up to $backup_path/.env"
    fi
    
    # Backup logs
    if [ -d "$PROJECT_ROOT/$environment/logs" ]; then
        cp -r "$PROJECT_ROOT/$environment/logs" "$backup_path/"
        log "Logs backed up to $backup_path/logs"
    fi
    
    # Create backup manifest
    cat > "$backup_path/manifest.json" << EOF
{
    "environment": "$environment",
    "timestamp": "$TIMESTAMP",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
    "backup_type": "manual"
}
EOF
    
    success "Backup created: $backup_name"
    echo "$backup_name"
}

# Function to list available backups
list_backups() {
    local environment=$1
    
    log "Available backups for $environment:"
    echo ""
    
    if [ ! -d "$BACKUP_DIR" ]; then
        warning "No backup directory found"
        return
    fi
    
    for backup in "$BACKUP_DIR"/backup_${environment}_*; do
        if [ -d "$backup" ]; then
            local backup_name=$(basename "$backup")
            local manifest="$backup/manifest.json"
            
            if [ -f "$manifest" ]; then
                local timestamp=$(jq -r '.timestamp' "$manifest" 2>/dev/null || echo "unknown")
                local commit=$(jq -r '.git_commit' "$manifest" 2>/dev/null || echo "unknown")
                echo "  📦 $backup_name"
                echo "     📅 Created: $timestamp"
                echo "     🔗 Commit: $commit"
                echo ""
            else
                echo "  📦 $backup_name (no manifest)"
                echo ""
            fi
        fi
    done
}

# Function to rollback to specific backup
rollback_to_backup() {
    local environment=$1
    local backup_name=$2
    local backup_path="$BACKUP_DIR/$backup_name"
    
    if [ ! -d "$backup_path" ]; then
        error "Backup $backup_name not found"
    fi
    
    log "Starting rollback to backup: $backup_name"
    
    # Stop services
    log "Stopping services..."
    pkill -f "node.*$environment" || true
    sleep 2
    
    # Create current state backup before rollback
    local pre_rollback_backup=$(create_backup "$environment")
    log "Pre-rollback backup created: $pre_rollback_backup"
    
    # Restore database
    if [ -f "$backup_path/delivery.db" ]; then
        log "Restoring database..."
        cp "$backup_path/delivery.db" "$PROJECT_ROOT/$environment/"
        success "Database restored"
    fi
    
    # Restore configuration
    if [ -f "$backup_path/.env" ]; then
        log "Restoring configuration..."
        cp "$backup_path/.env" "$PROJECT_ROOT/$environment/"
        success "Configuration restored"
    fi
    
    # Restore logs (optional)
    if [ -d "$backup_path/logs" ]; then
        log "Restoring logs..."
        cp -r "$backup_path/logs" "$PROJECT_ROOT/$environment/"
        success "Logs restored"
    fi
    
    # Start services
    log "Starting services..."
    cd "$PROJECT_ROOT/$environment"
    nohup ./start.sh > logs/start.log 2>&1 &
    
    # Wait for service to start
    log "Waiting for service to start..."
    sleep 10
    
    # Health check
    log "Performing health check..."
    if curl -f http://localhost:3000/health >/dev/null 2>&1; then
        success "Rollback completed successfully"
    else
        warning "Health check failed, but rollback completed"
    fi
}

# Function to rollback to git commit
rollback_to_commit() {
    local environment=$1
    local commit_hash=$2
    
    log "Starting rollback to git commit: $commit_hash"
    
    # Check if commit exists
    if ! git rev-parse --verify "$commit_hash" >/dev/null 2>&1; then
        error "Commit $commit_hash not found"
    fi
    
    # Create backup before rollback
    local pre_rollback_backup=$(create_backup "$environment")
    log "Pre-rollback backup created: $pre_rollback_backup"
    
    # Stop services
    log "Stopping services..."
    pkill -f "node.*$environment" || true
    sleep 2
    
    # Stash current changes
    git stash push -m "Pre-rollback stash $TIMESTAMP" || true
    
    # Checkout specific commit
    log "Checking out commit: $commit_hash"
    git checkout "$commit_hash"
    
    # Restore environment-specific files
    if [ -d "$PROJECT_ROOT/$environment" ]; then
        log "Restoring environment files..."
        cd "$PROJECT_ROOT/$environment"
        
        # Restore from backup if available
        if [ -f "$BACKUP_DIR/$pre_rollback_backup/.env" ]; then
            cp "$BACKUP_DIR/$pre_rollback_backup/.env" .
        fi
        
        if [ -f "$BACKUP_DIR/$pre_rollback_backup/delivery.db" ]; then
            cp "$BACKUP_DIR/$pre_rollback_backup/delivery.db" .
        fi
    fi
    
    # Start services
    log "Starting services..."
    cd "$PROJECT_ROOT/$environment"
    nohup ./start.sh > logs/start.log 2>&1 &
    
    # Wait for service to start
    log "Waiting for service to start..."
    sleep 10
    
    # Health check
    log "Performing health check..."
    if curl -f http://localhost:3000/health >/dev/null 2>&1; then
        success "Rollback to commit completed successfully"
    else
        warning "Health check failed, but rollback completed"
    fi
}

# Function to show usage
show_usage() {
    echo "🔄 DeliveryMiniapp Rollback Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  backup <environment>                    Create backup of environment"
    echo "  list <environment>                      List available backups"
    echo "  rollback-backup <environment> <backup>  Rollback to specific backup"
    echo "  rollback-commit <environment> <commit>  Rollback to git commit"
    echo "  help                                    Show this help message"
    echo ""
    echo "Environments:"
    echo "  development, staging, production"
    echo ""
    echo "Examples:"
    echo "  $0 backup production"
    echo "  $0 list production"
    echo "  $0 rollback-backup production backup_production_20231201_143022"
    echo "  $0 rollback-commit production abc1234"
}

# Main script logic
main() {
    # Create necessary directories
    mkdir -p "$BACKUP_DIR" "$LOG_DIR"
    
    # Check if we're in a git repository
    if [ ! -d "$PROJECT_ROOT/.git" ]; then
        warning "Not in a git repository. Some features may be limited."
    fi
    
    case "${1:-help}" in
        "backup")
            if [ -z "${2:-}" ]; then
                error "Environment not specified"
            fi
            create_backup "$2"
            ;;
        "list")
            if [ -z "${2:-}" ]; then
                error "Environment not specified"
            fi
            list_backups "$2"
            ;;
        "rollback-backup")
            if [ -z "${2:-}" ] || [ -z "${3:-}" ]; then
                error "Environment and backup name not specified"
            fi
            rollback_to_backup "$2" "$3"
            ;;
        "rollback-commit")
            if [ -z "${2:-}" ] || [ -z "${3:-}" ]; then
                error "Environment and commit hash not specified"
            fi
            rollback_to_commit "$2" "$3"
            ;;
        "help"|*)
            show_usage
            ;;
    esac
}

# Run main function with all arguments
main "$@" 