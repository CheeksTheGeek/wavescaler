import type { CommandAction, CommandCategory, CommandContext } from './types';

class CommandRegistry {
  private commands: Map<string, CommandAction> = new Map();
  private categories: Map<string, CommandCategory> = new Map();

  // Register a command
  register(command: CommandAction): void {
    this.commands.set(command.id, command);
  }

  // Register multiple commands
  registerMany(commands: CommandAction[]): void {
    commands.forEach(command => this.register(command));
  }

  // Register a category
  registerCategory(category: CommandCategory): void {
    this.categories.set(category.id, category);
  }

  // Get all available commands for current context
  getAvailableCommands(context: CommandContext): CommandAction[] {
    return Array.from(this.commands.values()).filter(command => 
      command.isAvailable ? command.isAvailable(context) : true
    );
  }

  // Search and filter commands
  searchCommands(query: string, context: CommandContext): CommandAction[] {
    const availableCommands = this.getAvailableCommands(context);
    
    if (!query.trim()) {
      return availableCommands;
    }

    const searchTerm = query.toLowerCase();
    
    return availableCommands.filter(command => {
      // Search in title
      if (command.title.toLowerCase().includes(searchTerm)) return true;
      
      // Search in description
      if (command.description?.toLowerCase().includes(searchTerm)) return true;
      
      // Search in keywords
      if (command.keywords?.some(keyword => 
        keyword.toLowerCase().includes(searchTerm)
      )) return true;
      
      // Search in category
      const category = this.categories.get(command.category);
      if (category?.title.toLowerCase().includes(searchTerm)) return true;
      
      return false;
    }).sort((a, b) => {
      // Sort by relevance - exact matches first, then partial matches
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      
      if (aTitle === searchTerm) return -1;
      if (bTitle === searchTerm) return 1;
      
      if (aTitle.startsWith(searchTerm) && !bTitle.startsWith(searchTerm)) return -1;
      if (bTitle.startsWith(searchTerm) && !aTitle.startsWith(searchTerm)) return 1;
      
      return aTitle.localeCompare(bTitle);
    });
  }

  // Get command by ID
  getCommand(id: string): CommandAction | undefined {
    return this.commands.get(id);
  }

  // Get category by ID
  getCategory(id: string): CommandCategory | undefined {
    return this.categories.get(id);
  }

  // Get all categories sorted by priority
  getCategories(): CommandCategory[] {
    return Array.from(this.categories.values()).sort((a, b) => a.priority - b.priority);
  }

  // Group commands by category
  getCommandsByCategory(context: CommandContext): Map<string, CommandAction[]> {
    const availableCommands = this.getAvailableCommands(context);
    const grouped = new Map<string, CommandAction[]>();
    
    availableCommands.forEach(command => {
      const categoryCommands = grouped.get(command.category) || [];
      categoryCommands.push(command);
      grouped.set(command.category, categoryCommands);
    });
    
    return grouped;
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry(); 
