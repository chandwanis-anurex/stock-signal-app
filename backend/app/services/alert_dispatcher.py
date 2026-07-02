"""
Sends a fired signal out over whichever channels are configured for the
rule that triggered it: SMS (Twilio), email (SendGrid), push (FCM -> APNs),
or a generic outbound webhook (e.g. TradersPost/SignalStack/your own broker
relay, or a direct TradeStation order endpoint you build on top of this).
"""
import os
import httpx

from app.models.models import AlertChannel, Signal


def _format_message(signal: Signal) -> str:
    return (
        f"{signal.side.upper()} signal: {signal.symbol} @ ${signal.price_at_signal:.2f} "
        f"({signal.fired_at.strftime('%Y-%m-%d %H:%M UTC')})"
    )


def send_whatsapp(message: str):
    from twilio.rest import Client

    client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
    client.messages.create(
        body=message,
        from_=os.getenv("TWILIO_WHATSAPP_FROM"),
        to=os.getenv("TWILIO_WHATSAPP_TO"),
    )


def send_email(destination: str, subject: str, message: str):
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail

    mail = Mail(
        from_email=os.getenv("ALERT_FROM_EMAIL"),
        to_emails=destination,
        subject=subject,
        plain_text_content=message,
    )
    sg = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
    sg.send(mail)


def send_push(device_token: str, title: str, message: str):
    httpx.post(
        "https://exp.host/--/api/v2/push/send",
        headers={"Content-Type": "application/json"},
        json={"to": device_token, "title": title, "body": message},
        timeout=10,
    )


def _buy_quantity(watchlist, price: float):
    """
    Converts a watchlist's position sizing setting into a share quantity for
    the order. Sell signals close the existing position instead, so no size
    is needed there. Falls back to None (quantity omitted) if sizing isn't
    configured or price is unusable, rather than sending a bogus 0.
    """
    if watchlist is None or not price:
        return None
    if watchlist.position_sizing_type == "shares":
        return watchlist.position_sizing_value
    dollars = watchlist.position_sizing_value or 0
    return int(dollars / price) or None


def send_webhook(url: str, signal: Signal, watchlist=None):
    quantity = _buy_quantity(watchlist, signal.price_at_signal) if signal.side == "buy" else None

    if "traderspost" in url.lower():
        payload = {
            "ticker": signal.symbol,
            "action": signal.side,
            "price": signal.price_at_signal,
            "sentiment": "bullish" if signal.side == "buy" else "bearish",
        }
        if quantity is not None:
            payload["quantity"] = quantity
    else:
        payload = {
            "symbol": signal.symbol,
            "side": signal.side,
            "price": signal.price_at_signal,
            "fired_at": signal.fired_at.isoformat(),
            "indicator_snapshot": signal.indicator_snapshot,
        }
        if quantity is not None:
            payload["quantity"] = quantity

    response = httpx.post(url, json=payload, timeout=10)
    response.raise_for_status()


def dispatch(channel: AlertChannel, signal: Signal):
    message = _format_message(signal)

    if channel.channel_type == "sms":
        send_whatsapp(message)
    elif channel.channel_type == "email":
        send_email(channel.destination, subject=f"Signal: {signal.symbol}", message=message)
    elif channel.channel_type == "push":
        send_push(channel.destination, title="New trading signal", message=message)
    elif channel.channel_type == "webhook":
        send_webhook(channel.destination, signal, channel.watchlist)
    else:
        raise ValueError(f"Unsupported channel type: {channel.channel_type}")
