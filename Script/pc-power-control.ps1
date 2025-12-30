<#
.SYNOPSIS
    PC Power Control Script for Windows

.DESCRIPTION
    Cross-platform script for shutdown, restart, and other power operations
    Supports: Windows 10/11, Windows Server

.PARAMETER Command
    The power operation to perform: shutdown, restart, sleep, hibernate, lock, logout, schedule, cancel, status

.PARAMETER Delay
    Delay in seconds before executing the operation (default: 0)

.PARAMETER Force
    Force the operation without confirmation

.PARAMETER Message
    Display a message before the operation

.PARAMETER ScheduledTime
    Time to schedule the operation (for schedule command, format: HH:mm)

.EXAMPLE
    .\pc-power-control.ps1 shutdown

.EXAMPLE
    .\pc-power-control.ps1 restart -Delay 60

.EXAMPLE
    .\pc-power-control.ps1 shutdown -Force -Message "Maintenance"

.EXAMPLE
    .\pc-power-control.ps1 schedule shutdown -ScheduledTime "23:00"

.NOTES
    Author: Claude Code Assistant
    Version: 1.0.0
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("shutdown", "restart", "sleep", "hibernate", "lock", "logout", "schedule", "cancel", "status", "help")]
    [string]$Command = "help",

    [Parameter(Position = 1)]
    [string]$ScheduleAction = "",

    [Alias("d")]
    [int]$Delay = 0,

    [Alias("f")]
    [switch]$Force,

    [Alias("m")]
    [string]$Message = "",

    [Alias("t")]
    [string]$ScheduledTime = ""
)

# Script configuration
$Script:TaskName = "PCPowerControl_ScheduledShutdown"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Show-Usage {
    $usage = @"
PC Power Control Script for Windows
====================================

Usage: .\pc-power-control.ps1 <Command> [Options]

Commands:
  shutdown    - Shut down the computer
  restart     - Restart the computer
  sleep       - Put computer to sleep
  hibernate   - Hibernate the computer
  lock        - Lock the screen
  logout      - Log out current user
  schedule    - Schedule a shutdown/restart
  cancel      - Cancel scheduled shutdown
  status      - Show system power status
  help        - Show this help message

Options:
  -Delay <seconds>       Delay before executing (default: 0)
  -Force                 Force operation (skip confirmation)
  -Message <text>        Display message before operation
  -ScheduledTime <HH:mm> Schedule time (for schedule command)

Examples:
  .\pc-power-control.ps1 shutdown                           # Immediate shutdown
  .\pc-power-control.ps1 restart -Delay 60                  # Restart in 60 seconds
  .\pc-power-control.ps1 shutdown -Force -Message "Update"  # Force shutdown with message
  .\pc-power-control.ps1 schedule shutdown -ScheduledTime "23:00"  # Schedule at 11 PM
  .\pc-power-control.ps1 cancel                             # Cancel scheduled operation

"@
    Write-Host $usage
}

function Test-AdminPrivileges {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Request-Confirmation {
    param([string]$Action)

    if (-not $Force) {
        $response = Read-Host "Are you sure you want to $Action? [y/N]"
        if ($response -notmatch "^[Yy]$") {
            Write-ColorOutput "Operation cancelled." "Yellow"
            return $false
        }
    }
    return $true
}

function Start-Countdown {
    param([int]$Seconds)

    if ($Seconds -gt 0) {
        Write-ColorOutput "Operation will execute in $Seconds seconds..." "Cyan"
        Write-ColorOutput "Press Ctrl+C to cancel" "Yellow"

        for ($i = $Seconds; $i -gt 0; $i--) {
            Write-Host "`rTime remaining: ${i}s   " -NoNewline -ForegroundColor Yellow
            Start-Sleep -Seconds 1
        }
        Write-Host ""
    }
}

function Invoke-Shutdown {
    if ($Message) {
        Write-ColorOutput "Message: $Message" "Cyan"
    }

    if (-not (Request-Confirmation "shut down the computer")) {
        return
    }

    Start-Countdown -Seconds $Delay

    Write-ColorOutput "Shutting down..." "Red"

    if ($Message) {
        Stop-Computer -Force:$Force -ComputerName localhost
    } else {
        Stop-Computer -Force:$Force
    }
}

function Invoke-Restart {
    if ($Message) {
        Write-ColorOutput "Message: $Message" "Cyan"
    }

    if (-not (Request-Confirmation "restart the computer")) {
        return
    }

    Start-Countdown -Seconds $Delay

    Write-ColorOutput "Restarting..." "Yellow"
    Restart-Computer -Force:$Force
}

function Invoke-Sleep {
    if (-not (Request-Confirmation "put the computer to sleep")) {
        return
    }

    Start-Countdown -Seconds $Delay

    Write-ColorOutput "Going to sleep..." "Cyan"

    # Use Windows API for sleep
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class PowerControl {
        [DllImport("powrprof.dll", SetLastError = true)]
        public static extern bool SetSuspendState(bool hibernate, bool forceCritical, bool disableWakeEvent);
    }
"@

    [PowerControl]::SetSuspendState($false, $false, $false)
}

function Invoke-Hibernate {
    if (-not (Request-Confirmation "hibernate the computer")) {
        return
    }

    # Check if hibernate is enabled
    $hibernateEnabled = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Power" -Name "HibernateEnabled" -ErrorAction SilentlyContinue).HibernateEnabled

    if ($hibernateEnabled -ne 1) {
        Write-ColorOutput "Hibernate is not enabled on this system." "Red"
        Write-ColorOutput "To enable hibernate, run as Administrator: powercfg /hibernate on" "Yellow"
        return
    }

    Start-Countdown -Seconds $Delay

    Write-ColorOutput "Hibernating..." "Cyan"

    # Use shutdown command for hibernate
    & shutdown /h
}

function Invoke-Lock {
    Write-ColorOutput "Locking screen..." "Cyan"
    & rundll32.exe user32.dll,LockWorkStation
}

function Invoke-Logout {
    if (-not (Request-Confirmation "log out")) {
        return
    }

    Start-Countdown -Seconds $Delay

    Write-ColorOutput "Logging out..." "Yellow"
    & logoff
}

function Invoke-Schedule {
    param([string]$Action)

    if ([string]::IsNullOrEmpty($ScheduledTime)) {
        Write-ColorOutput "Error: Please specify time with -ScheduledTime option (HH:mm format)" "Red"
        return
    }

    if ($Action -notin @("shutdown", "restart")) {
        Write-ColorOutput "Error: Can only schedule shutdown or restart" "Red"
        return
    }

    # Parse the scheduled time
    try {
        $targetTime = [DateTime]::ParseExact($ScheduledTime, "HH:mm", $null)
        $now = Get-Date

        # If the time is earlier today, schedule for tomorrow
        if ($targetTime -lt $now) {
            $targetTime = $targetTime.AddDays(1)
        } else {
            $targetTime = Get-Date -Hour $targetTime.Hour -Minute $targetTime.Minute -Second 0
        }
    }
    catch {
        Write-ColorOutput "Error: Invalid time format. Use HH:mm (e.g., 23:00)" "Red"
        return
    }

    Write-ColorOutput "Scheduling $Action at $ScheduledTime..." "Cyan"

    # Remove existing scheduled task if any
    Unregister-ScheduledTask -TaskName $Script:TaskName -Confirm:$false -ErrorAction SilentlyContinue

    # Determine the action argument
    $shutdownArg = if ($Action -eq "shutdown") { "/s" } else { "/r" }

    # Create scheduled task
    $taskAction = New-ScheduledTaskAction -Execute "shutdown.exe" -Argument "$shutdownArg /t 60 /c `"Scheduled $Action`""
    $taskTrigger = New-ScheduledTaskTrigger -Once -At $targetTime
    $taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

    try {
        Register-ScheduledTask -TaskName $Script:TaskName -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Settings $taskSettings -Force | Out-Null
        Write-ColorOutput "Successfully scheduled $Action for $($targetTime.ToString('yyyy-MM-dd HH:mm'))" "Green"
    }
    catch {
        Write-ColorOutput "Error scheduling task: $_" "Red"
        Write-ColorOutput "Try running PowerShell as Administrator" "Yellow"
    }
}

function Invoke-Cancel {
    Write-ColorOutput "Cancelling scheduled operation..." "Cyan"

    # Cancel any pending shutdown
    & shutdown /a 2>$null

    # Remove scheduled task
    $task = Get-ScheduledTask -TaskName $Script:TaskName -ErrorAction SilentlyContinue
    if ($task) {
        Unregister-ScheduledTask -TaskName $Script:TaskName -Confirm:$false
        Write-ColorOutput "Scheduled task cancelled" "Green"
    }
    else {
        Write-ColorOutput "No scheduled shutdown to cancel" "Yellow"
    }
}

function Get-SystemStatus {
    Write-ColorOutput "System Power Status" "Cyan"
    Write-Host "===================="

    # Basic system info
    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    $computer = Get-CimInstance -ClassName Win32_ComputerSystem

    Write-Host "Computer Name: $($computer.Name)"
    Write-Host "Operating System: $($os.Caption)"
    Write-Host "Current User: $env:USERNAME"

    # Calculate uptime
    $uptime = (Get-Date) - $os.LastBootUpTime
    Write-Host "Uptime: $($uptime.Days) days, $($uptime.Hours) hours, $($uptime.Minutes) minutes"

    Write-Host ""
    Write-Host "Power Configuration:"

    # Get active power plan
    $activePlan = powercfg /getactivescheme
    Write-Host "  $activePlan"

    # Check hibernate status
    $hibernateEnabled = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Power" -Name "HibernateEnabled" -ErrorAction SilentlyContinue).HibernateEnabled
    Write-Host "  Hibernate Enabled: $(if ($hibernateEnabled -eq 1) { 'Yes' } else { 'No' })"

    # Check for scheduled shutdown task
    Write-Host ""
    $task = Get-ScheduledTask -TaskName $Script:TaskName -ErrorAction SilentlyContinue
    if ($task) {
        $taskInfo = Get-ScheduledTaskInfo -TaskName $Script:TaskName -ErrorAction SilentlyContinue
        Write-Host "Scheduled Shutdown:"
        Write-Host "  Status: $($task.State)"
        if ($taskInfo.NextRunTime) {
            Write-Host "  Next Run: $($taskInfo.NextRunTime)"
        }
    }
    else {
        Write-Host "No scheduled shutdown/restart pending"
    }

    # Battery status (for laptops)
    $battery = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue
    if ($battery) {
        Write-Host ""
        Write-Host "Battery Status:"
        Write-Host "  Charge: $($battery.EstimatedChargeRemaining)%"
        Write-Host "  Status: $(switch ($battery.BatteryStatus) {
            1 { 'Discharging' }
            2 { 'AC Power' }
            3 { 'Fully Charged' }
            4 { 'Low' }
            5 { 'Critical' }
            6 { 'Charging' }
            7 { 'Charging/High' }
            8 { 'Charging/Low' }
            9 { 'Charging/Critical' }
            default { 'Unknown' }
        })"
    }
}

# Main execution
switch ($Command.ToLower()) {
    "shutdown" {
        Invoke-Shutdown
    }
    "restart" {
        Invoke-Restart
    }
    "sleep" {
        Invoke-Sleep
    }
    "hibernate" {
        Invoke-Hibernate
    }
    "lock" {
        Invoke-Lock
    }
    "logout" {
        Invoke-Logout
    }
    "schedule" {
        if ([string]::IsNullOrEmpty($ScheduleAction)) {
            Write-ColorOutput "Error: Please specify action to schedule (shutdown or restart)" "Red"
            Write-ColorOutput "Example: .\pc-power-control.ps1 schedule shutdown -ScheduledTime '23:00'" "Yellow"
        }
        else {
            Invoke-Schedule -Action $ScheduleAction
        }
    }
    "cancel" {
        Invoke-Cancel
    }
    "status" {
        Get-SystemStatus
    }
    "help" {
        Show-Usage
    }
    default {
        Show-Usage
    }
}
