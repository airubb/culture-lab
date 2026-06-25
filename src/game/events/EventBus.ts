export type EventHandler<TEvent extends { type: string }> = (event: TEvent) => void;

export class EventBus<TEvent extends { type: string }> {
  private readonly handlers = new Map<TEvent["type"], Set<EventHandler<TEvent>>>();

  subscribe<TType extends TEvent["type"]>(
    type: TType,
    handler: EventHandler<Extract<TEvent, { type: TType }>>,
  ): () => void {
    const existingHandlers = this.handlers.get(type) ?? new Set<EventHandler<TEvent>>();
    existingHandlers.add(handler as EventHandler<TEvent>);
    this.handlers.set(type, existingHandlers);

    return () => {
      existingHandlers.delete(handler as EventHandler<TEvent>);
    };
  }

  publish(event: TEvent): void {
    this.handlers.get(event.type)?.forEach((handler) => handler(event));
  }
}