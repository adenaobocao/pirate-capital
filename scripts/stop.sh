#!/bin/zsh
# Kill switch: halt all real-money trading instantly. Paper keeps running.
# Remove ~/.pirate-capital/STOP to resume.
touch "$HOME/.pirate-capital/STOP"
echo "STOP engaged. real trading halted. remove $HOME/.pirate-capital/STOP to resume."
