import { Command, commands, Disposable } from "vscode";

export default class RuntimeCommand {
    private static readonly prefix = "vencord-companion-runtime-command";

    private static registeredCommands: Record<string, Disposable> = {};

    private readonly thisDispose: Disposable;
    private getCommandId() {
        return `${RuntimeCommand.prefix}.${this.label}`;
    }
    constructor(private readonly label: string, action: (...args: any[]) => any, thisArg?: any) {
        if(RuntimeCommand.registeredCommands[this.getCommandId()])
            RuntimeCommand.registeredCommands[this.getCommandId()].dispose();

        this.thisDispose = commands.registerCommand(this.getCommandId(), action, thisArg);

        RuntimeCommand.registeredCommands[this.getCommandId()] = this.thisDispose;
    }

    public dispose() {
        this.dispose();
        delete RuntimeCommand.registeredCommands[this.getCommandId()];
    }

    public asCommand(title = this.label, tooltip?: string, ...args: any[]): Command {
        return {
            command: this.getCommandId(),
            title,
            tooltip,
            arguments: args
        };
    }

    public static disposeCommand(label: string) {
        const command = RuntimeCommand.registeredCommands[`${RuntimeCommand.prefix}.${label}`];
        if (command)
            command.dispose();
        delete RuntimeCommand.registeredCommands[`${RuntimeCommand.prefix}.${label}`];
    }
}
